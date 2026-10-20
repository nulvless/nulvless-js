import type { HttpClient } from '../http'
import { route } from '../http'
import type { NulvlessResult, RequestOptions } from '../types'
import type { SessionManager } from '../session/manager'
import { TabChannel } from '../session/tabChannel'
import type {
  AuthMethods,
  Authenticated,
  Challenge,
  LookupParams,
  LookupResult,
  OAuthProvider,
  RecoverParams,
  RefreshTokenParams,
  ResetPasswordParams,
  Session,
  SignInParams,
  SignInWithOTPParams,
  SignOutScope,
  SignUpParams,
  VerifyChallengeParams,
  VerifyParams,
  Verified,
} from './types'
import { FactorsClient } from './factors'
import { UsersClient } from './users'
import { SessionsClient } from './sessions'
import { SecurityClient } from './security'
import { ChallengesClient } from './challenges'
import { GrantsClient } from './grants'
import { OAuthClient } from './oauth'
import { AdminClient } from './admin'
import { AccountsManager, extractUserId } from './accounts'
import type { AccountEntry } from './accounts'
import { AuthEventEmitter } from './emitter'
import type { AuthEvents } from './emitter'
import type { NulvlessStorage } from '../storage/types'
import { toAuthenticated } from '../session/stored'
import { resolveBearer } from './base'

/**
 * Auth methods accessible with both public (`pk_`) and private (`sk_`) keys.
 */
export class AuthClient {
  /** MFA factor management — enroll, enable, disable, recovery codes. */
  readonly factors: FactorsClient
  /** Current-user management — profile, identities, credential updates. */
  readonly users: UsersClient
  /** Active session management — list, revoke, sudo mode. */
  readonly sessions: SessionsClient
  /** Account security — change password. */
  readonly security: SecurityClient
  /** Challenge lifecycle — create, get, change, verify (MFA / OTP / step-up). */
  readonly challenges: ChallengesClient
  /** OAuth server (project as OIDC provider) — token, consent, userinfo, grants, discovery. */
  readonly oauth: OAuthClient

  protected readonly _getToken: () => Promise<string | null>

  constructor(
    protected readonly http: HttpClient,
    protected readonly session?: SessionManager,
  ) {
    // Inject refresh function into SessionManager after construction
    // to avoid circular dependency.
    session?.setRefreshFn((refresh_token) =>
      this.http.post<Authenticated>('/token', { refresh_token }, {
        query: { grant_type: 'refresh_token' },
      }),
    )

    this._getToken = () => this.session?.getValidToken() ?? Promise.resolve(null)

    this.factors = new FactorsClient(http, this._getToken)
    this.users = new UsersClient(http, this._getToken)
    this.sessions = new SessionsClient(http, this._getToken, (result) =>
      this.persistSession(result),
    )
    this.security = new SecurityClient(http, this._getToken)
    this.challenges = new ChallengesClient(http, this._getToken, (result) =>
      this.persistSession(result),
    )
    this.oauth = new OAuthClient(http, this._getToken)
  }

  /**
   * Returns the current active access token from storage.
   * Refreshes automatically if the token is expired or about to expire.
   * Returns `null` when there is no active session.
   */
  async getAccessToken(): Promise<string | null> {
    return this.session?.getValidToken() ?? null
  }

  protected async persistSession(result: NulvlessResult<Authenticated>): Promise<NulvlessResult<Authenticated>> {
    if (!result.error && result.data.access_token && this.session) {
      await this.session.save(result.data)
    }

    return result
  }

  /**
   * Creates a new user account.
   *
   * At least one of `email`, `phone`, or `username` must be provided.
   *
   * Check the response in this order:
   * 1. `data.access_token` → authenticated immediately — session stored automatically.
   * 2. `data.challenge` → MFA/OTP step required — call `verifyChallenge`.
   * 3. `data.user` only → pending email/phone confirmation.
   */
  async signUp(params: SignUpParams, options?: RequestOptions): Promise<NulvlessResult<Authenticated>> {
    return this.persistSession(
      await this.http.post<Authenticated>('/signup', params, options),
    )
  }

  /**
   * Signs in with password (`grant_type=password`).
   *
   * At least one of `email`, `phone`, or `username` must be provided.
   *
   * Check the response in this order:
   * 1. `data.access_token` → signed in — session stored automatically.
   * 2. `data.challenge` → MFA step required — call `verifyChallenge`.
   */
  async signIn(params: SignInParams, options?: RequestOptions): Promise<NulvlessResult<Authenticated>> {
    return this.persistSession(
      await this.http.post<Authenticated>('/token', params, {
        ...options,
        query: { grant_type: 'password' },
      }),
    )
  }

  /**
   * Requests a one-time password sent to the user's email or phone.
   *
   * Returns a `Challenge` (`202 Accepted`). Pass the received code to `verifyChallenge`.
   *
   * At least one of `email` or `phone` must be provided.
   */
  signInWithOTP(params: SignInWithOTPParams, options?: RequestOptions): Promise<NulvlessResult<Challenge>> {
    return this.http.post<Challenge>('/otp', params, options)
  }

  /**
   * Initiates an OAuth sign-in flow for the given provider.
   *
   * In a browser environment the user is redirected automatically to the
   * authorization URL. On the server the URL is returned for manual handling.
   *
   * After the redirect, the server-side callback exchanges the code automatically
   * and redirects back to `options.redirect_uri`. For server-side code exchange, use `exchangeCodeForToken`.
   *
   * @example
   * // Browser — redirects automatically
   * await nulvless.auth.authorize('google', { redirect_uri: 'https://myapp.com/callback' })
   *
   * // Server — use the returned URL
   * const { data } = await nulvless.auth.authorize('google', { redirect_uri: 'https://myapp.com/callback' })
   * return Response.redirect(data.url)
   */
  async authorize(
    provider: OAuthProvider,
    options?: RequestOptions,
  ): Promise<NulvlessResult<{ url: string; provider: OAuthProvider }>> {
    const result = await this.http.get<{ url: string; provider: OAuthProvider }>(
      route`/oauth/${provider}/authorize`,
      { ...options, query: { ...(options?.redirect_uri ? { redirect_uri: options.redirect_uri } : {}) } },
    )

    if (!result.error && typeof window !== 'undefined') {
      window.location.href = result.data.url
    }

    return result
  }

  /**
   * Initiates an OAuth flow to connect a new provider to the authenticated user's account.
   *
   * Same behaviour as `authorize`, but for users who are already signed in — the resulting
   * provider identity is linked to the current account instead of starting a sign-in flow.
   *
   * In a browser environment the user is redirected automatically to the
   * authorization URL. On the server the URL is returned for manual handling.
   *
   * Requires authentication. Token is resolved automatically from storage
   * (browser) or from `options.headers.Authorization` (server).
   *
   * @example
   * await nulvless.auth.connect('github', { redirect_uri: 'https://myapp.com/settings/connections' })
   */
  async connect(
    provider: OAuthProvider,
    options?: RequestOptions,
  ): Promise<NulvlessResult<{ url: string; provider: OAuthProvider }>> {
    const auth = await resolveBearer(this.http, this._getToken, options)
    if (!auth.ok) return { data: null, error: auth.error }

    const result = await this.http.get<{ url: string; provider: OAuthProvider }>(
      route`/oauth/${provider}/connect`,
      {
        ...options,
        headers: { ...options?.headers, ...auth.headers },
        query: { ...(options?.redirect_uri ? { redirect_uri: options.redirect_uri } : {}) },
      },
    )

    if (!result.error && typeof window !== 'undefined') {
      window.location.href = result.data.url
    }

    return result
  }

  /**
   * Signs in with an ID token issued by a third-party OAuth provider.
   *
   * Useful for mobile apps where you obtain the ID token natively (e.g. Google Sign-In SDK).
   *
   * Session is stored automatically when the response contains an access token.
   *
   * @example
   * const { data } = await nulvless.auth.signInWithIdToken('google', googleIdToken)
   */
  async signInWithIdToken(
    provider: OAuthProvider,
    idToken: string,
    options?: RequestOptions,
  ): Promise<NulvlessResult<Authenticated>> {
    return this.persistSession(
      await this.http.get<Authenticated>(route`/signin/${provider}/id_token`, {
        ...options,
        query: { id_token: idToken },
      }),
    )
  }

  /**
   * Exchanges an OAuth authorization code for an access token
   * (`grant_type=authorization_code`).
   *
   * Must be called with `Content-Type: application/x-www-form-urlencoded`.
   * The `code` must be the authorization code received from the OAuth callback.
   *
   * Session is stored automatically when the response contains an access token.
   *
   * @example
   * const { data } = await nulvless.auth.exchangeCodeForToken('auth-code-from-callback')
   */
  async exchangeCodeForToken(code: string, options?: RequestOptions): Promise<NulvlessResult<Authenticated>> {
    return this.persistSession(
      await this.http.post<Authenticated>(
        '/token',
        { code },
        {
          ...options,
          query: { grant_type: 'authorization_code' },
          headers: {
            ...options?.headers,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      ),
    )
  }

  /**
   * Returns all sign-in methods, MFA factors, and OAuth providers configured
   * for the authenticated user on this platform.
   *
   * Requires authentication.
   */
  async getMethods(options?: RequestOptions): Promise<NulvlessResult<AuthMethods>> {
    const auth = await resolveBearer(this.http, this._getToken, options)
    if (!auth.ok) return { data: null, error: auth.error }

    return this.http.get<AuthMethods>('/methods', {
      ...options,
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  /**
   * Looks up whether an identifier exists and which sign-in method applies.
   *
   * Useful for adaptive sign-in UIs. May return a `challenge` directly
   * when the user's method is OTP-only.
   *
   * At least one of `email`, `phone`, or `username` must be provided.
   */
  lookup(params: LookupParams, options?: RequestOptions): Promise<NulvlessResult<LookupResult>> {
    return this.http.post<LookupResult>('/lookup', params, options)
  }

  /**
   * Verifies a challenge by submitting the token and the code entered by the user.
   *
   * Used for:
   * - OTP sign-in (`signInWithOTP` flow)
   * - MFA verification after `signIn`
   * - Sign-up confirmation (`signUp` challenge flow)
   *
   * Convenience alias for `auth.challenges.verify`. Session is stored
   * automatically when the response contains an access token. For the rest of
   * the challenge lifecycle (create, get, change) use `auth.challenges`.
   */
  async verifyChallenge(params: VerifyChallengeParams, options?: RequestOptions): Promise<NulvlessResult<Authenticated>> {
    return this.challenges.verify(params, options)
  }

  /**
   * Activates an account via the confirmation link sent to the user's email/phone.
   */
  activate(token: string, options?: RequestOptions): Promise<NulvlessResult<null>> {
    return this.http.get<null>('/activate', { ...options, query: { token } })
  }

  /**
   * Refreshes the access token using a refresh token (`grant_type=refresh_token`).
   * Session is updated automatically in storage.
   */
  async refreshToken(params: RefreshTokenParams, options?: RequestOptions): Promise<NulvlessResult<Authenticated>> {
    return this.persistSession(
      await this.http.post<Authenticated>('/token', params, {
        ...options,
        query: { grant_type: 'refresh_token' },
      }),
    )
  }

  /**
   * Sends a password-recovery email to the user.
   */
  recover(params: RecoverParams, options?: RequestOptions): Promise<NulvlessResult<null>> {
    return this.http.post<null>('/recover', {
      ...params,
      ...(options?.redirect_uri ? { redirect_uri: options.redirect_uri } : {}),
    }, options)
  }

  /**
   * Resets the user's password using the token from the recovery email.
   */
  resetPassword(params: ResetPasswordParams, options?: RequestOptions): Promise<NulvlessResult<null>> {
    return this.http.post<null>('/recover/reset-password', params, options)
  }

  /**
   * Validates the current session and optionally checks a grant.
   *
   * Requires authentication. Token is resolved automatically from storage
   * (browser) or from `options.headers.Authorization` (server).
   */
  async verify(grant?: VerifyParams, options?: RequestOptions): Promise<NulvlessResult<Verified>> {
    const auth = await resolveBearer(this.http, this._getToken, options)
    if (!auth.ok) return { data: null, error: auth.error }

    return this.http.get<Verified>('/session/validate', {
      ...options,
      headers: { ...options?.headers, ...auth.headers },
      query: {
        ...(grant?.resource ? { resource: grant.resource } : {}),
        ...(grant?.scopes ? { scopes: grant.scopes.join(' ') } : {}),
        ...(grant?.roles ? { roles: grant.roles.join(' ') } : {}),
        ...(grant?.reject_assurance_level_error !== undefined
          ? { reject_assurance_level_error: String(grant.reject_assurance_level_error) }
          : {}),
      },
    })
  }

  /**
   * Returns the current session details.
   *
   * Requires authentication. Token is resolved automatically from storage
   * (browser) or from `options.headers.Authorization` (server).
   */
  async getSession(options?: RequestOptions): Promise<NulvlessResult<Session>> {
    const auth = await resolveBearer(this.http, this._getToken, options)
    if (!auth.ok) return { data: null, error: auth.error }

    return this.http.get<Session>('/session', {
      ...options,
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  /**
   * Signs out the user and clears the stored session.
   *
   * - `'local'` (default) — invalidates only the current session.
   * - `'global'` — invalidates all sessions across all devices.
   * - `'others'` — invalidates all sessions except the current one.
   *
   * Requires authentication. Token is resolved automatically from storage
   * (browser) or from `options.headers.Authorization` (server).
   */
  async signOut(scope?: SignOutScope, options?: RequestOptions): Promise<NulvlessResult<null>> {
    const auth = await resolveBearer(this.http, this._getToken, options)
    if (!auth.ok) return { data: null, error: auth.error }

    const result = await this.http.post<null>('/signout', undefined, {
      ...options,
      headers: { ...options?.headers, ...auth.headers },
      ...(scope ? { query: { scope } } : {}),
    })

    if (!result.error) {
      await this.session?.clear()
    }

    return result
  }
}

/**
 * Auth client for browser use (`createClient` / public key).
 * Extends `AuthClient` with session management and multi-account helpers.
 */
export class AuthBrowserClient extends AuthClient {
  private readonly accountsManager: AccountsManager
  private readonly emitter: AuthEventEmitter
  private readonly multiUser: boolean
  private readonly tabs: TabChannel<Authenticated | null>

  constructor(
    http: HttpClient,
    session: SessionManager,
    storage: NulvlessStorage,
    accountsKey: string,
    multiUser = false,
    autoRefresh = true,
  ) {
    super(http, session)
    this.multiUser = multiUser
    this.accountsManager = new AccountsManager(storage, accountsKey)
    this.emitter = new AuthEventEmitter()

    this.tabs = new TabChannel<Authenticated | null>(`nulvless.auth.${accountsKey}`, message => {
      this.emitter.emit(
        message.event as 'token-refreshed',
        message.payload as Authenticated,
      )
    })

    session.setOnTokenRefreshed((auth) => {
      if (this.multiUser) {
        void this.accountsManager.save(auth)
      }

      this.emitter.emit('token-refreshed', auth)
      this.tabs.post({ event: 'token-refreshed', payload: auth })
    })

    session.setOnUnauthorized((failed) => {
      this.emitter.emit('unauthorized', failed ? toAuthenticated(failed) : {})
    })

    http.setOnSudoRequired(() => {
      this.emitter.emit('sudo-required')
    })

    if (autoRefresh) {
      session.startAutoRefresh()
    }
  }

  /**
   * Renews the access token now, sharing the attempt with any refresh already
   * in flight. Returns the new token, or `null` when the session could not be
   * recovered.
   */
  async refreshSession(): Promise<string | null> {
    return this.session?.forceRefresh() ?? null
  }

  /** Releases the refresh timer and the cross-tab channel. */
  dispose(): void {
    this.session?.stopAutoRefresh()
    this.tabs.close()
  }

  /**
   * Subscribes to an auth event.
   *
   * Returns an unsubscribe function — call it to stop listening.
   *
   * @example
   * const off = nulvless.auth.on('signed-in', (session) => {
   *   console.log('signed in as', session.user?.id)
   * })
   * off() // unsubscribe
   */
  on<K extends keyof AuthEvents>(
    event: K,
    handler: AuthEvents[K] extends void ? () => void : (payload: AuthEvents[K]) => void,
  ): () => void {
    return this.emitter.on(event, handler)
  }

  protected override async persistSession(result: NulvlessResult<Authenticated>): Promise<NulvlessResult<Authenticated>> {
    const out = await super.persistSession(result)

    if (!out.error) {
      if (out.data.access_token) {
        if (this.multiUser) {
          await this.accountsManager.save(out.data)
        }
        this.emitter.emit('signed-in', out.data)
      } else if (out.data.challenge) {
        this.emitter.emit('challenge', out.data)
      }
    }

    return out
  }

  /**
   * Returns the session currently stored in storage, or `null` if there is none.
   *
   * `expires_in` is the number of seconds remaining until expiry (may be negative
   * if the token is already expired).
   *
   * @example
   * const session = await nulvless.auth.get()
   * if (session) {
   *   console.log(session.access_token, session.expires_in)
   * }
   */
  async get(): Promise<Authenticated | null> {
    const stored = await this.session?.get()
    return stored ? toAuthenticated(stored) : null
  }

  /**
   * Manually persists a session as the active session.
   *
   * Use this when you obtain an `Authenticated` outside the normal SDK flow
   * (e.g. server-side login, custom OAuth callback) and want the SDK to treat
   * it as the active session.
   *
   * @example
   * await nulvless.auth.set({ access_token: 'eyJ...', refresh_token: 'rt_...', expires_in: 3600 })
   */
  async set(data: Authenticated): Promise<void> {
    if (data.access_token) {
      await this.session?.save(data)
    }
  }

  /**
   * Adds an account to the accounts store without switching the active session.
   *
   * The account is identified by the `user.id` in the response, or by the `sub`
   * claim in the access token JWT.
   *
   * Call this after a sign-in to register additional accounts. Accounts are
   * also saved automatically whenever a sign-in / sign-up succeeds.
   *
   * @example
   * const { data } = await nulvless.auth.signIn(params)
   * // already saved automatically — or add manually:
   * await nulvless.auth.add(data)
   */
  async add(auth: Authenticated): Promise<void> {
    if (!this.multiUser || !auth.access_token) return
    await this.accountsManager.save(auth)
  }

  /**
   * Switches the active session to a previously saved account.
   *
   * Returns `true` on success, `false` if the account is not found.
   *
   * @example
   * const ok = await nulvless.auth.switch('user-id-123')
   */
  async switch(userId: string): Promise<boolean> {
    if (!this.multiUser) return false

    const stored = await this.accountsManager.getSession(userId)

    if (!stored) return false

    await this.session?.save(toAuthenticated(stored))

    this.emitter.emit('account-switched', { userId })
    return true
  }

  /**
   * Returns all accounts currently saved in the accounts store.
   *
   * @example
   * const accounts = await nulvless.auth.list()
   * // [{ userId: '...', access_token: '...', expires_in: 3540 }]
   */
  list(): Promise<AccountEntry[]> {
    if (!this.multiUser) return Promise.resolve([])
    return this.accountsManager.list()
  }

  /**
   * Removes a saved account from the accounts store.
   *
   * Does not affect the active session.
   *
   * @example
   * await nulvless.auth.remove('user-id-123')
   */
  remove(userId: string): Promise<void> {
    if (!this.multiUser) return Promise.resolve()
    return this.accountsManager.remove(userId)
  }

  /**
   * Drops the active session without ending it on the server.
   *
   * The account stays in the accounts store, so `switch` brings it back. Use
   * this when the user leaves the authenticated area to pick or add another
   * account: with no active session the automatic refresh goes quiet instead
   * of keeping a session warm that nothing is using.
   *
   * @example
   * await nulvless.auth.deselect()
   * // later
   * await nulvless.auth.switch('user-id-123')
   */
  async deselect(): Promise<void> {
    const stored = await this.session?.get()

    if (!stored) return

    if (this.multiUser) {
      await this.accountsManager.save(toAuthenticated(stored))
    }

    await this.session?.clear()
  }

  override async signOut(scope?: SignOutScope, options?: RequestOptions): Promise<NulvlessResult<null>> {
    // Capture userId before the session is cleared
    const stored = await this.session?.get()
    const userId = stored
      ? (stored.user?.id ?? extractUserId({ access_token: stored.access_token }))
      : null

    const result = await super.signOut(scope, options)

    if (!result.error) {
      if (this.multiUser && userId) {
        await this.accountsManager.remove(userId)
      }
      this.emitter.emit('signed-out', { ...(userId ? { userId } : {}) })
    }

    return result
  }
}

/**
 * Auth methods exclusive to private (`sk_`) keys.
 * Extends `AuthClient` — all public methods and sub-namespaces are available here too.
 *
 * Additional sub-namespaces:
 * - `auth.grants` — grant management (invite, revoke, accept, etc.)
 * - `auth.admin` — platform administration (users, roles, grants)
 *
 * Never use in browser code.
 */
export class AuthServerClient extends AuthClient {
  /** User-facing grant management — invite, accept, revoke, etc. */
  readonly grants: GrantsClient
  /** Platform administration — manage users, roles, and grants server-side. */
  readonly admin: AdminClient

  constructor(http: HttpClient) {
    super(http)
    this.grants = new GrantsClient(http, this._getToken)
    this.admin = new AdminClient(http)
  }
}
