import type { ClientOptions, Language, NulvlessError, NulvlessResult } from './types'
import { NulvlessException } from './exceptions/nulvless.exception'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

type QueryValue = string | number | boolean
type QueryParams = Record<string, QueryValue | QueryValue[] | undefined>

const DOT_SEGMENT = /(^|\/)\.{1,2}(\/|$)/

interface SendOptions {
  query?: QueryParams
  /** Override or add headers for this request. Merged over client-level headers. */
  headers?: Record<string, string>
  body?: unknown
  /** Override the language header for this request. */
  language?: () => Language
  /** Override the throwErrors strategy for this request. */
  throwErrors?: boolean
  /** Abort this request after the given number of milliseconds. Overrides the client-level timeout. */
  timeout?: number
  /** Single-use sudo nonce, sent as the `nlv-sudo-nonce` header. */
  nonce?: string | undefined
  /** Omit the `x-platform-key` header — for public endpoints that don't require it. */
  skipApiKey?: boolean
}

function resolveConfigHeaders(
  value: Record<string, string> | (() => Record<string, string>) | undefined,
): Record<string, string> | undefined {
  return typeof value === 'function' ? value() : value
}

function mergeHeaders(...sources: Array<Record<string, string> | undefined>): Record<string, string> {
  const merged = new Map<string, [name: string, value: string]>()

  for (const source of sources) {
    for (const [name, value] of Object.entries(source ?? {})) {
      merged.set(name.toLowerCase(), [name, value])
    }
  }

  return Object.fromEntries(merged.values())
}

function findHeader(headers: Record<string, string> | undefined, name: string): string | undefined {
  const wanted = name.toLowerCase()

  return Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === wanted)?.[1]
}

export function route(strings: TemplateStringsArray, ...values: Array<string | number>): string {
  return strings.reduce((path, part, index) => path + encodeURIComponent(String(values[index - 1])) + part)
}

class InvalidPathError extends Error {
  constructor(path: string) {
    super(`Path parameters cannot be "." or "..": ${path}`)
    this.name = 'InvalidPathError'
  }
}

export interface HttpClientConfig extends ClientOptions {
  baseUrl: string
  apiKey: string
  /**
   * Called when a request fails with a retryable auth error (401 or specific 403 codes).
   * Should return a fresh access token, or `null` if refresh is not possible.
   * The request is retried once with the new token.
   *
   * `deauthOnFailure` is `true` for 401/unauthorized (token is invalid — clear session
   * and notify if refresh fails) and `false` for 403/forbidden_resource_access (token
   * is valid but lacks the scope — refresh once to pick up new scopes, but never
   * deauthenticate; surface the API error instead).
   */
  onTokenExpired?: (context: {
    deauthOnFailure: boolean
    expiredToken?: string
  }) => Promise<string | null>
}

function toError(err: unknown, timeout?: number): NulvlessError {
  if (err instanceof InvalidPathError) {
    return { code: 'invalid_path', message: err.message, status_code: 400 }
  }
  if (err instanceof Error && err.name === 'AbortError') {
    return {
      code: 'request_timeout',
      message: `Request timed out after ${timeout ?? 0}ms`,
      status_code: 408,
    }
  }
  return {
    code: 'network_error',
    message: err instanceof Error ? err.message : 'Network request failed',
    status_code: 0,
  }
}

function extractErrorPayload(
  body: unknown,
  fallback: string,
): Pick<NulvlessError, 'code' | 'message'> {
  if (typeof body !== 'object' || body === null) {
    return { code: 'unknown_error', message: fallback }
  }

  const record = body as Record<string, unknown>

  const code = typeof record['code'] === 'string' ? record['code'] : 'unknown_error'

  const message =
    typeof record['message'] === 'string' || Array.isArray(record['message'])
      ? (record['message'] as string | string[])
      : fallback

  return { code, message }
}

export class HttpClient {
  private readonly config: HttpClientConfig
  private onSudoRequired?: () => void

  constructor(config: HttpClientConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl.replace(/\/+$/, ''),
    }
  }

  /**
   * Injected after construction to avoid circular dependency.
   * Called when a request fails with `403 protected_action_denied`,
   * indicating the user must enable sudo mode before retrying.
   */
  setOnSudoRequired(cb: () => void): void {
    this.onSudoRequired = cb
  }

  hasAuthorization(headers?: Record<string, string>): boolean {
    return (
      findHeader(headers, 'Authorization') !== undefined ||
      findHeader(resolveConfigHeaders(this.config.headers), 'Authorization') !== undefined
    )
  }

  async get<T>(path: string, options?: Omit<SendOptions, 'body'>): Promise<NulvlessResult<T>> {
    return this.send<T>('GET', path, options)
  }

  async post<T>(path: string, body?: unknown, options?: Omit<SendOptions, 'body'>): Promise<NulvlessResult<T>> {
    return this.send<T>('POST', path, { ...options, body })
  }

  async put<T>(path: string, body?: unknown, options?: Omit<SendOptions, 'body'>): Promise<NulvlessResult<T>> {
    return this.send<T>('PUT', path, { ...options, body })
  }

  async patch<T>(path: string, body?: unknown, options?: Omit<SendOptions, 'body'>): Promise<NulvlessResult<T>> {
    return this.send<T>('PATCH', path, { ...options, body })
  }

  async delete<T>(path: string, options?: Omit<SendOptions, 'body'>): Promise<NulvlessResult<T>> {
    return this.send<T>('DELETE', path, options)
  }

  /**
   * Returns `true` when the error warrants a single token-refresh retry:
   * - Any 401 on an authenticated request
   * - 403 with `forbidden_access_waiting_accept` or `forbidden_resource_access` codes
   */
  private shouldRetryWithRefresh(
    status: number,
    code: string,
    headers: Record<string, string>,
  ): boolean {
    if (!findHeader(headers, 'Authorization')) return false
    if (status === 401) return true
    if (status === 403 && ['forbidden_resource_access', 'forbidden_access_waiting_accept'].includes(code)) return true
    return false
  }

  private async send<T>(method: HttpMethod, path: string, options: SendOptions = {}, isRetry = false): Promise<NulvlessResult<T>> {
    const headers = this.buildHeaders(options.headers, options.language, options.nonce, options.skipApiKey)

    const shouldThrow = options.throwErrors ?? this.config.throwErrors ?? false

    const timeout = options.timeout ?? this.config.timeout
    const controller = new AbortController()
    const timeoutHandle =
      timeout && timeout > 0
        ? setTimeout(() => controller.abort(), timeout)
        : undefined

    const start = Date.now()

    if (this.config.debug) {
      console.debug(`[nulvless] → ${method} ${path}`)
    }

    try {
      const url = this.buildUrl(path, options.query)
      const init: RequestInit = { method, headers, signal: controller.signal }

      if (options.body !== undefined) {
        const contentType = findHeader(headers, 'Content-Type')

        if (contentType === 'application/x-www-form-urlencoded') {
          init.body = new URLSearchParams(options.body as Record<string, string>).toString()
        } else {
          init.body = JSON.stringify(options.body)
        }
      }

      const response = await fetch(url, init)
      const body = await this.parseBody(response)

      if (this.config.debug) {
        console.debug(`[nulvless] ← ${method} ${path} ${response.status} (${Date.now() - start}ms)`)
      }

      if (!response.ok) {
        const { code, message } = extractErrorPayload(body, response.statusText)
        const error: NulvlessError = { code, message, status_code: response.status }

        // Reactive refresh: on specific 401/403 responses, refresh once and retry.
        if (
          !isRetry &&
          this.config.onTokenExpired &&
          this.shouldRetryWithRefresh(response.status, code, headers)
        ) {
          const deauthOnFailure = response.status === 401
          const expiredToken = findHeader(headers, 'Authorization')?.replace(/^Bearer\s+/i, '')
          const newToken = await this.config.onTokenExpired({
            deauthOnFailure,
            ...(expiredToken ? { expiredToken } : {}),
          })
          if (newToken) {
            return this.send<T>(
              method,
              path,
              { ...options, headers: mergeHeaders(options.headers, { Authorization: `Bearer ${newToken}` }) },
              true,
            )
          }
        }

        if (response.status === 403 && code === 'protected_action_denied') {
          this.onSudoRequired?.()
        }

        if (shouldThrow) {
          throw new NulvlessException(message, code, response.status)
        }

        return { data: null, error }
      }

      return { data: body as T, error: null }
    } catch (err) {
      if (err instanceof NulvlessException) throw err

      const error = toError(err, timeout)

      if (shouldThrow) {
        throw new NulvlessException(error.message, error.code, error.status_code)
      }

      return { data: null, error }
    } finally {
      clearTimeout(timeoutHandle)
    }
  }

  private buildUrl(path: string, query?: QueryParams): string {
    if (DOT_SEGMENT.test(path)) throw new InvalidPathError(path)

    const url = new URL(`${this.config.baseUrl}/${path.replace(/^\/+/, '')}`)

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined) continue
        const values = Array.isArray(value) ? value : [value]
        for (const v of values) {
          url.searchParams.append(Array.isArray(value) ? `${key}[]` : key, String(v))
        }
      }
    }

    return url.toString()
  }

  private buildHeaders(
    extra?: Record<string, string>,
    languageOverride?: () => Language,
    nonce?: string,
    skipApiKey?: boolean,
  ): Record<string, string> {
    const language = languageOverride?.() ?? this.config.language?.() ?? 'en-US'

    return mergeHeaders(
      {
        'Content-Type': 'application/json',
        ...(skipApiKey ? {} : { 'x-platform-key': this.config.apiKey }),
        'nlv-lang': language,
        ...(this.config.trackUser !== undefined
          ? { 'nlv-user-tracking': String(this.config.trackUser) }
          : {}),
        ...(nonce ? { 'nlv-sudo-nonce': nonce } : {}),
      },
      resolveConfigHeaders(this.config.headers),
      extra,
    )
  }

  private async parseBody(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('json')) return null

    try {
      return await response.json()
    } catch {
      return null
    }
  }
}
