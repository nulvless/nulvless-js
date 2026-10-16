import { route } from '../../http'
import type { NulvlessResult, RequestOptions } from '../../types'
import type {
  AddEmailIdentityParams,
  AddPhoneIdentityParams,
  Challenge,
  Identity,
  IdentityType,
  RemoveIdentityParams,
  SendOTPToUpdateEmailParams,
  SendOTPToUpdatePhoneParams,
  UpdateIdentityParams,
  User,
  UserProfile,
  VerifyChallengeParams,
} from '../types'
import { AuthSubClient } from '../base'

/**
 * Current-user management.
 *
 * Available on both `createClient` (browser) and `createServerClient` (server).
 *
 * All methods require authentication. Pass `options.headers.Authorization` on
 * the server, or rely on the configured storage for automatic token injection.
 */
export class UsersClient extends AuthSubClient {

  // ─── Profile ────────────────────────────────────────────────────────────────

  /**
   * Returns the authenticated user's full profile.
   */
  async me(options?: RequestOptions): Promise<NulvlessResult<User>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    return this.http.get<User>('/users/me', {
      ...options,
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  /**
   * Updates the authenticated user's profile fields.
   *
   * Omit fields to leave them unchanged.
   */
  async update(
    params: { username?: string; profile?: UserProfile },
    options?: RequestOptions,
  ): Promise<NulvlessResult<User>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    return this.http.patch<User>('/users', params, {
      ...options,
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  // ─── Identities ─────────────────────────────────────────────────────────────

  /**
   * Lists all identities (email, phone, OAuth) linked to the authenticated user.
   *
   * @param type Filter by identity type: `'email'`, `'phone'`, or `'oauth'`.
   */
  async getIdentities(type?: IdentityType, options?: RequestOptions): Promise<NulvlessResult<Identity[]>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    return this.http.get<Identity[]>('/users/identities', {
      ...options,
      headers: { ...options?.headers, ...auth.headers },
      ...(type ? { query: { type } } : {}),
    })
  }

  /**
   * Initiates adding a new email identity. Sends an OTP to the provided address.
   *
   * Complete the flow with `verifyIdentity`.
   *
   * Requires sudo: `MANAGE_IDENTITIES`.
   */
  async addEmailIdentity(
    params: AddEmailIdentityParams,
    options?: RequestOptions,
  ): Promise<NulvlessResult<Challenge>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    const { nonce, email } = params
    return this.http.post<Challenge>('/users/identities/emails', { email }, {
      ...options,
      nonce,
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  /**
   * Initiates adding a new phone identity. Sends an OTP to the provided number.
   *
   * Complete the flow with `verifyIdentity`.
   *
   * Requires sudo: `MANAGE_IDENTITIES`.
   */
  async addPhoneIdentity(
    params: AddPhoneIdentityParams,
    options?: RequestOptions,
  ): Promise<NulvlessResult<Challenge>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    const { nonce, phone } = params
    return this.http.post<Challenge>('/users/identities/phones', phone, {
      ...options,
      nonce,
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  /**
   * Confirms an identity addition by submitting the OTP received via
   * `addEmailIdentity` or `addPhoneIdentity`.
   */
  async verifyIdentity(params: VerifyChallengeParams, options?: RequestOptions): Promise<NulvlessResult<User>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    return this.http.post<User>('/users/identities/verify', params, {
      ...options,
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  /**
   * Updates an identity — currently used to set an identity as primary.
   *
   * Requires sudo: `MANAGE_IDENTITIES`.
   */
  async updateIdentity(
    params: UpdateIdentityParams,
    options?: RequestOptions,
  ): Promise<NulvlessResult<User>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    const { nonce, id, primary } = params
    return this.http.patch<User>(route`/users/identities/${id}`, { primary }, {
      ...options,
      nonce,
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  /**
   * Unlinks (removes) an identity from the authenticated user.
   *
   * Requires sudo: `MANAGE_IDENTITIES`.
   */
  async removeIdentity(
    params: RemoveIdentityParams,
    options?: RequestOptions,
  ): Promise<NulvlessResult<Identity>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    const { nonce, id } = params
    return this.http.delete<Identity>(route`/users/identities/${id}`, {
      ...options,
      nonce,
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  // ─── Credential updates ──────────────────────────────────────────────────────

  /**
   * Sends an OTP to the new email address to initiate an email change.
   *
   * Complete the flow with `confirmEmailUpdate`.
   *
   * Requires sudo: `MANAGE_CREDENTIALS`.
   */
  async sendOTPToUpdateEmail(
    params: SendOTPToUpdateEmailParams,
    options?: RequestOptions,
  ): Promise<NulvlessResult<{ token: string }>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    const { nonce, email } = params
    return this.http.post<{ token: string }>('/users/emails/code/send', { email }, {
      ...options,
      nonce,
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  /**
   * Confirms an email change by submitting the OTP received via `sendOTPToUpdateEmail`.
   */
  async confirmEmailUpdate(params: VerifyChallengeParams, options?: RequestOptions): Promise<NulvlessResult<User>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    return this.http.patch<User>('/users/emails/code/confirm', params, {
      ...options,
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  /**
   * Sends an OTP to the new phone number to initiate a phone change.
   *
   * Complete the flow with `confirmPhoneUpdate`.
   *
   * Requires sudo: `MANAGE_CREDENTIALS`.
   */
  async sendOTPToUpdatePhone(
    params: SendOTPToUpdatePhoneParams,
    options?: RequestOptions,
  ): Promise<NulvlessResult<{ token: string }>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    const { nonce, phone } = params
    return this.http.post<{ token: string }>('/users/phones/code/send', phone, {
      ...options,
      nonce,
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  /**
   * Confirms a phone change by submitting the OTP received via `sendOTPToUpdatePhone`.
   */
  async confirmPhoneUpdate(params: VerifyChallengeParams, options?: RequestOptions): Promise<NulvlessResult<User>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    return this.http.patch<User>('/users/phones/code/confirm', params, {
      ...options,
      headers: { ...options?.headers, ...auth.headers },
    })
  }
}
