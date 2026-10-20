import type { ErrorCode } from './error-codes'
import type { NulvlessStorage } from './storage/types'

// ─── Core ─────────────────────────────────────────────────────────────────────

export type Language = 'en-US' | 'pt-BR'

export interface Phone {
  /** Country dial code — e.g. "+55" */
  country_code: string
  /** Digits only, 6–18 chars */
  number: string
}

export interface NulvlessError {
  code: ErrorCode
  message: string | string[]
  status_code: number
}

/**
 * Every SDK method returns this type.
 * Check `error` first — if null, `data` is guaranteed to be present.
 */
export type NulvlessResult<T> =
  | { data: T; error: null }
  | { data: null; error: NulvlessError }

export interface AuthOptions {
  captcha_token?: string
}

export interface ClientOptions {
  /** Returns the BCP 47 language tag sent on every request. Defaults to `'en-US'`. */
  language?: () => Language
  /** Abort requests after this many milliseconds. */
  timeout?: number
  /** Log request/response info to the console. */
  debug?: boolean
  /**
   * Extra headers merged into every request.
   *
   * Pass a function to resolve headers lazily per request — useful for
   * forwarding values from a request-local context (CLS, AsyncLocalStorage,
   * NestJS REQUEST, etc.) without rebuilding the client.
   *
   * @example Static headers
   * ```ts
   * createServerClient(url, sk, { headers: { 'x-app-version': '1.0.0' } })
   * ```
   *
   * @example Per-request resolution (e.g. forwardUserHeaders from a CLS store)
   * ```ts
   * createServerClient(url, sk, {
   *   trackUser: true,
   *   headers: () => forwardUserHeaders(cls.get('req')),
   * })
   * ```
   */
  headers?: Record<string, string> | (() => Record<string, string>)
  /**
   * Renews the access token on a timer, ahead of expiry, instead of waiting
   * for a request to find it expired. Defaults to `true`; turn it off when the
   * host controls renewal itself. Browser clients only.
   */
  autoRefresh?: boolean
  /**
   * When `true`, failed requests throw a `NulvlessException` instead of
   * returning `{ data: null, error }`.
   *
   * Can be overridden per-request via `RequestOptions.throwErrors`.
   */
  throwErrors?: boolean
  /**
   * Storage adapter for persisting session tokens.
   *
   * Defaults to `localStorage` in the browser and to a per-client in-memory
   * store elsewhere (SSR, tests, workers).
   *
   * Use the built-in `Storage` adapters from `@nulvless/nulvless-js`:
   * ```ts
   * import { Storage } from '@nulvless/nulvless-js'
   *
   * createClient(url, key, { storage: Storage.Local })
   * ```
   *
   * Only used by `createClient` (browser). Has no effect on `createServerClient`.
   */
  storage?: NulvlessStorage
  /**
   * Custom storage keys for the browser session.
   *
   * - `token` — key for the active session token. Defaults to `nlv-<slug>-token`.
   * - `accounts` — key for the multi-account store. Defaults to `nlv-<slug>-token-accounts`.
   *
   * Only used by `createClient` (browser).
   */
  storageKeys?: {
    token?: string
    accounts?: string
  }
  /**
   * When `true`, enables multi-account support — the SDK stores all signed-in
   * accounts and exposes `auth.add`, `auth.list`, `auth.remove`, and `auth.switch`.
   *
   * Defaults to `false`. Enable explicitly only when your app needs account switching.
   *
   * Only used by `createClient` (browser).
   */
  multiUser?: boolean
  /**
   * When `true`, sends `nlv-user-tracking: "true"` on every request, signalling
   * the auth service to collect device/browser fingerprint data for the session.
   *
   * In the browser (`createClient`), standard headers like `User-Agent`,
   * `Origin`, and `Referer` are sent automatically by `fetch`.
   *
   * In the server (`createServerClient`), use `forwardUserHeaders(req)` via
   * `options.headers` on each call to forward the real user's browser headers.
   */
  trackUser?: boolean
}

/**
 * Options for `createServerClient` / `NulvlessServerClient`.
 * Identical to `ClientOptions` but without `storage` — session persistence
 * is a browser-only concern and must not be used on the server.
 */
export type ServerClientOptions = Omit<ClientOptions, 'storage' | 'storageKeys'>

/**
 * Per-request options — override client-level config for a single call.
 * Passed as the last argument to methods that support it.
 *
 * Lib-side toggles stay camelCase (`throwErrors`, `language`, `timeout`,
 * `headers`). Backend-bound fields use snake_case (`redirect_uri`) so they
 * pass through to the wire unchanged.
 */
export interface RequestOptions {
  /** Override the language header for this request. */
  language?: () => Language
  /**
   * Override (or add) HTTP headers for this request. Merged over client-level headers.
   *
   * For lazy/context-resolved headers shared across all calls, use
   * `ClientOptions.headers` (function form) instead.
   */
  headers?: Record<string, string>
  /** Override the `throwErrors` strategy for this request. */
  throwErrors?: boolean
  /** Redirect URI passed as body/query param for OAuth and confirmation flows. */
  redirect_uri?: string
  /** Abort this request after the given number of milliseconds. Overrides the client-level `timeout`. */
  timeout?: number
}
