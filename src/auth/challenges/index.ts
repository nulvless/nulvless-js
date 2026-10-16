import type { HttpClient } from '../../http'
import { route } from '../../http'
import type { NulvlessResult, RequestOptions } from '../../types'
import type {
  Authenticated,
  Challenge,
  ChangeChallengeParams,
  MFAMethod,
  VerifyChallengeParams,
} from '../types'
import { AuthSubClient } from '../base'

/**
 * Challenge lifecycle — create, inspect, switch method, and verify.
 *
 * Mirrors the `/challenges` resource. Used by MFA, OTP sign-in, sign-up
 * confirmation and step-up (sudo) flows.
 *
 * Available on both `createClient` (browser) and `createServerClient` (server).
 */
export class ChallengesClient extends AuthSubClient {
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
   * Creates a verification challenge for the given MFA method (step-up).
   *
   * Requires an authenticated session. Prompt the user for the code, then call
   * `verify({ token, code })`.
   *
   * @example
   * const { data } = await nulvless.auth.challenges.create('totp')
   */
  async create(
    targetType: MFAMethod,
    options?: RequestOptions,
  ): Promise<NulvlessResult<{ challenge: Challenge }>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    return this.http.post<{ challenge: Challenge }>(route`/challenges/${targetType}`, undefined, {
      ...options,
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  /**
   * Retrieves the current state of a challenge by its token.
   */
  get(token: string, options?: RequestOptions): Promise<NulvlessResult<Challenge>> {
    return this.http.get<Challenge>('/challenges', { ...options, query: { token } })
  }

  /**
   * Switches the preferred MFA method for an ongoing challenge.
   *
   * @example
   * const { data } = await nulvless.auth.challenges.change({ token, type: 'totp' })
   */
  change(
    params: ChangeChallengeParams,
    options?: RequestOptions,
  ): Promise<NulvlessResult<{ challenge: Challenge }>> {
    return this.http.patch<{ challenge: Challenge }>(
      route`/challenges/${params.type}`,
      { token: params.token },
      options,
    )
  }

  /**
   * Verifies a challenge by submitting the token and the code entered by the user.
   *
   * Used for OTP sign-in, MFA verification after `signIn`, and sign-up
   * confirmation. Session is stored automatically when the response contains an
   * access token.
   */
  async verify(
    params: VerifyChallengeParams,
    options?: RequestOptions,
  ): Promise<NulvlessResult<Authenticated>> {
    return this.persist(await this.http.post<Authenticated>('/challenges/verify', params, options))
  }
}
