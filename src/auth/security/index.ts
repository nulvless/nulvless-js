import type { NulvlessResult, RequestOptions } from '../../types'
import type { ChangePasswordParams } from '../types'
import { AuthSubClient } from '../base'

/**
 * Account security operations (password).
 *
 * Available on both `createClient` (browser) and `createServerClient` (server).
 *
 * All methods require authentication. Pass `options.headers.Authorization` on
 * the server, or rely on the configured storage for automatic token injection.
 */
export class SecurityClient extends AuthSubClient {

  /**
   * Changes the authenticated user's password.
   *
   * @example
   * await nulvless.auth.security.changePassword({
   *   password: 'current-password',
   *   new_password: 'new-password',
   * })
   */
  async changePassword(params: ChangePasswordParams, options?: RequestOptions): Promise<NulvlessResult<null>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    const { nonce, ...body } = params
    return this.http.put<null>('/security/password', body, {
      ...options,
      nonce,
      headers: { ...options?.headers, ...auth.headers },
    })
  }
}
