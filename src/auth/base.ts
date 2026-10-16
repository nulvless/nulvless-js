import type { HttpClient } from '../http'
import type { NulvlessError, RequestOptions } from '../types'

export type BearerResolution =
  | { ok: true; headers: Record<string, string> }
  | { ok: false; error: NulvlessError }

const NO_SESSION_ERROR: NulvlessError = {
  code: 'no_session',
  message: 'No active session.',
  status_code: 401,
}

export async function resolveBearer(
  http: HttpClient,
  getToken: () => Promise<string | null>,
  options?: RequestOptions,
): Promise<BearerResolution> {
  if (http.hasAuthorization(options?.headers)) return { ok: true, headers: {} }

  const token = await getToken()

  if (!token) return { ok: false, error: { ...NO_SESSION_ERROR } }

  return { ok: true, headers: { Authorization: `Bearer ${token}` } }
}

export abstract class AuthSubClient {
  constructor(
    protected readonly http: HttpClient,
    protected readonly getToken: () => Promise<string | null>,
  ) {}

  protected bearer(options?: RequestOptions): Promise<BearerResolution> {
    return resolveBearer(this.http, this.getToken, options)
  }
}
