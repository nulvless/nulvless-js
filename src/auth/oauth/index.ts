import type { HttpClient } from '../../http'
import { route } from '../../http'
import type { NulvlessResult, RequestOptions } from '../../types'
import type {
  ExchangeOAuthCodeParams,
  OAuthApp,
  OAuthAuthorization,
  OAuthAuthorizeParams,
  OAuthConsentAction,
  OAuthConsentResult,
  OAuthDiscovery,
  OAuthJWKS,
  OAuthTokenResponse,
  OAuthUserGrant,
  OAuthUserInfo,
  RefreshOAuthTokenParams,
  RegisterOAuthAppParams,
} from '../types'
import { AuthSubClient } from '../base'

/**
 * Manages the OAuth apps the authenticated user has authorized
 * (`/user/oauth/grants`). Requires authentication (bearer token).
 */
export class OAuthGrantsClient extends AuthSubClient {
  /**
   * Lists the apps the authenticated user has granted access to.
   */
  async list(options?: RequestOptions): Promise<NulvlessResult<OAuthUserGrant[]>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    return this.http.get<OAuthUserGrant[]>('/user/oauth/grants', {
      ...options,
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  /**
   * Revokes a previously granted app by its public `client_id`.
   * Also invalidates the app's active sessions for this user.
   */
  async revoke(clientId: string, options?: RequestOptions): Promise<NulvlessResult<null>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    return this.http.delete<null>('/user/oauth/grants', {
      ...options,
      headers: { ...options?.headers, ...auth.headers },
      query: { client_id: clientId },
    })
  }
}

/**
 * The project's OAuth 2.1 / OpenID Connect provider surface — the project
 * acting as an identity provider for third-party applications.
 *
 * Available with both public (`pk_`) and private (`sk_`) keys.
 *
 * Method scopes:
 * - `token`, `register` — platform key only (no bearer token).
 * - `getAuthorization`, `consent`, `userinfo`, and the `grants` namespace —
 *   authenticated user (bearer token).
 * - `discovery`, `jwks` — public OIDC metadata (no auth).
 *
 * The `/oauth/authorize` entry point is a browser redirect (302), not a JSON
 * API — build it from `discovery().authorization_endpoint` and redirect the
 * user agent there.
 */
export class OAuthClient extends AuthSubClient {
  /** Apps the authenticated user has authorized — list and revoke. */
  readonly grants: OAuthGrantsClient

  constructor(http: HttpClient, getToken: () => Promise<string | null>) {
    super(http, getToken)
    this.grants = new OAuthGrantsClient(http, getToken)
  }

  /**
   * Builds the OAuth authorization URL and, in the browser, redirects the user
   * agent to it. On the server the URL is returned for manual handling.
   *
   * Mirrors `auth.authorize` (social sign-in): redirects automatically in the
   * browser, returns `data.url` on the server. The endpoint itself is a 302
   * redirect, so the URL is composed from the discovery `authorization_endpoint`.
   *
   * PKCE is required (RFC 7636, https://www.rfc-editor.org/rfc/rfc7636): provide
   * `code_challenge` = BASE64URL(SHA256(code_verifier)) with
   * `code_challenge_method: 'S256'`. Send the `code_verifier` later to
   * `exchangeCodeForToken`.
   *
   * @example
   * // Browser — redirects automatically
   * await nulvless.auth.oauth.authorize({ client_id, redirect_uri, code_challenge, code_challenge_method: 'S256' })
   *
   * // Server — use the returned URL
   * const { data } = await nulvless.auth.oauth.authorize(params)
   * return Response.redirect(data.url)
   */
  async authorize(params: OAuthAuthorizeParams, options?: RequestOptions): Promise<NulvlessResult<{ url: string }>> {
    const discovery = await this.discovery(options)
    if (discovery.error) return { data: null, error: discovery.error }

    const url = new URL(discovery.data.authorization_endpoint)
    const query: Record<string, string | undefined> = {
      client_id: params.client_id,
      redirect_uri: params.redirect_uri,
      response_type: params.response_type ?? 'code',
      code_challenge: params.code_challenge,
      code_challenge_method: params.code_challenge_method,
      scope: params.scope,
      state: params.state,
      resource: params.resource,
      nonce: params.nonce,
    }
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, value)
    }

    if (typeof window !== 'undefined') {
      window.location.href = url.toString()
    }

    return { data: { url: url.toString() }, error: null }
  }

  /**
   * Exchanges an authorization code for tokens
   * (`POST /oauth/token`, `grant_type=authorization_code`).
   *
   * Called by the relying-party app after the user is redirected back with the
   * `code`. PKCE `code_verifier` is required; `client_secret` only for
   * confidential clients. Public endpoint — no platform key.
   */
  exchangeCodeForToken(
    params: ExchangeOAuthCodeParams,
    options?: RequestOptions,
  ): Promise<NulvlessResult<OAuthTokenResponse>> {
    return this.http.post<OAuthTokenResponse>(
      '/oauth/token',
      { grant_type: 'authorization_code', ...params },
      { ...options, skipApiKey: true },
    )
  }

  /**
   * Refreshes an access token using a refresh token
   * (`POST /oauth/token`, `grant_type=refresh_token`).
   *
   * `client_secret` only for confidential clients. Public endpoint — no
   * platform key.
   */
  refreshToken(
    params: RefreshOAuthTokenParams,
    options?: RequestOptions,
  ): Promise<NulvlessResult<OAuthTokenResponse>> {
    return this.http.post<OAuthTokenResponse>(
      '/oauth/token',
      { grant_type: 'refresh_token', ...params },
      { ...options, skipApiKey: true },
    )
  }

  /**
   * Dynamically registers a new OAuth app (RFC 7591, `POST /oauth/register`).
   *
   * Requires the OAuth server to be enabled with dynamic client registration
   * allowed. For server-side managed registration use `admin.oauthClients`.
   */
  register(params: RegisterOAuthAppParams, options?: RequestOptions): Promise<NulvlessResult<OAuthApp>> {
    // Public endpoint (RFC 7591), gated server-side by config — no platform key.
    return this.http.post<OAuthApp>('/oauth/register', params, { ...options, skipApiKey: true })
  }

  /**
   * Loads a pending authorization for the consent screen
   * (`GET /oauth/authorizations/:id`).
   *
   * Claims the authorization for the authenticated user. When a matching
   * consent already exists it is auto-approved and `redirect.uri` is returned.
   *
   * Requires authentication.
   */
  async getAuthorization(authorizationId: string, options?: RequestOptions): Promise<NulvlessResult<OAuthAuthorization>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    return this.http.get<OAuthAuthorization>(route`/oauth/authorizations/${authorizationId}`, {
      ...options,
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  /**
   * Approves or denies a pending authorization
   * (`POST /oauth/authorizations/:id/consent`).
   *
   * Returns the `redirect.uri` to send the user agent back to (carrying the
   * authorization `code` on approve, or `error=access_denied` on deny).
   *
   * Requires authentication.
   */
  async consent(
    authorizationId: string,
    action: OAuthConsentAction,
    options?: RequestOptions,
  ): Promise<NulvlessResult<OAuthConsentResult>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    return this.http.post<OAuthConsentResult>(route`/oauth/authorizations/${authorizationId}/consent`, { action }, {
      ...options,
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  /**
   * Returns OIDC UserInfo claims for the access token (`GET /oauth/userinfo`).
   *
   * The access token must have been issued with the `openid` scope.
   *
   * Requires authentication.
   */
  async userinfo(options?: RequestOptions): Promise<NulvlessResult<OAuthUserInfo>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    return this.http.get<OAuthUserInfo>('/oauth/userinfo', {
      ...options,
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  /**
   * Returns the OpenID Connect discovery document
   * (`GET /.well-known/openid-configuration`). Public — no auth required.
   */
  discovery(options?: RequestOptions): Promise<NulvlessResult<OAuthDiscovery>> {
    // Public OIDC metadata — no platform key.
    return this.http.get<OAuthDiscovery>('/.well-known/openid-configuration', { ...options, skipApiKey: true })
  }

  /**
   * Returns the JSON Web Key Set used to verify issued tokens
   * (`GET /.well-known/jwks.json`). Public — no auth required.
   */
  jwks(options?: RequestOptions): Promise<NulvlessResult<OAuthJWKS>> {
    // Public OIDC metadata — no platform key.
    return this.http.get<OAuthJWKS>('/.well-known/jwks.json', { ...options, skipApiKey: true })
  }
}
