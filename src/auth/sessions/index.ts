import type { HttpClient } from '../../http'
import { route } from '../../http'
import type { NulvlessResult, RequestOptions } from '../../types'
import type {
  Authenticated,
  Challenge,
  Nonce,
  RevokeSessionParams,
  Session,
  SudoMethod,
} from '../types'
import { AuthSubClient } from '../base'

/**
 * Active session management for the authenticated user.
 *
 * Available on both `createClient` (browser) and `createServerClient` (server).
 *
 * All methods require authentication. Pass `options.headers.Authorization` on
 * the server, or rely on the configured storage for automatic token injection.
 */
export class SessionsClient extends AuthSubClient {
  constructor(
    http: HttpClient,
    getToken: () => Promise<string | null>,
    private readonly persist: (
      result: NulvlessResult<Authenticated>,
    ) => Promise<NulvlessResult<Authenticated>>,
  ) {
    super(http, getToken)
  }

  /**
   * Returns all active sessions for the authenticated user across all devices.
   * The current session is marked with `is_current_session: true`.
   */
  async list(options?: RequestOptions): Promise<NulvlessResult<Session[]>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    return this.http.get<Session[]>('/sessions', {
      ...options,
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  /**
   * Revokes (invalidates) a specific session by its ID.
   *
   * Use `auth.getSession()` to get the current session ID.
   *
   * Requires sudo: `MANAGE_SESSIONS`.
   */
  async revoke(params: RevokeSessionParams, options?: RequestOptions): Promise<NulvlessResult<null>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    const { nonce, id } = params
    return this.http.delete<null>(route`/sessions/${id}`, {
      ...options,
      nonce,
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  /**
   * Starts a sudo elevation by requesting a verification challenge.
   *
   * The available methods are derived from what the user has (TOTP if active,
   * email OTP, SMS OTP). Pass `method` to request a specific one; if omitted and
   * the user has a single method it is emitted automatically, otherwise an empty
   * challenge is returned so the user can pick which one to send.
   *
   * Prompt the user for the code, then call `sudoVerify({ code })` to complete
   * the elevation. The verify response carries `sudo.expires_in` (seconds until
   * sudo mode expires) alongside the refreshed session tokens.
   *
   * @example
   * const { data } = await nulvless.auth.sessions.sudo() // or sudo('email_otp')
   * // prompt the user for the code, then call sudoVerify({ code })
   */
  async sudo(
    method?: SudoMethod,
    options?: RequestOptions,
  ): Promise<NulvlessResult<{ challenge: Challenge }>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    return this.http.get<{ challenge: Challenge }>('/sessions/sudo/request', {
      ...options,
      ...(method ? { query: { method } } : {}),
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  /**
   * Completes a sudo elevation started by `sudo()`. Submit the `code` the user
   * received (or read from their authenticator) — the pending sudo challenge is
   * resolved by the current session, so no challenge token is needed.
   *
   * On success the session is re-issued with sudo mode active and stored
   * automatically; `data.sudo.expires_in` carries the seconds until it expires.
   *
   * @example
   * const { data } = await nulvless.auth.sessions.sudoVerify({ code })
   * // data.sudo?.expires_in → 300
   */
  async sudoVerify(
    params: { code: string },
    options?: RequestOptions,
  ): Promise<NulvlessResult<Authenticated>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    return this.persist(
      await this.http.post<Authenticated>('/sessions/sudo/verify', params, {
        ...options,
        headers: { ...options?.headers, ...auth.headers },
      }),
    )
  }

  /**
   * Verifies that sudo mode is currently active for the session.
   *
   * Returns `204 No Content` on success. Returns an error if sudo is not active.
   *
   * @example
   * const { error } = await nulvless.auth.sessions.checkSudo()
   * if (error) {
   *   // Start the sudo flow: sessions.sudo() → sessions.sudoVerify
   * }
   */
  async checkSudo(params?: Nonce, options?: RequestOptions): Promise<NulvlessResult<null>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    return this.http.get<null>('/sessions/sudo', {
      ...options,
      nonce: params?.nonce,
      headers: { ...options?.headers, ...auth.headers },
    })
  }
}
