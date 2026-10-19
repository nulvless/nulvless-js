import type { Phone, AuthOptions } from '../types'

// ─── Sudo ─────────────────────────────────────────────────────────────────────

/**
 * Single-use sudo nonce for step-up auth.
 *
 * Pass the code the user received from `auth.sessions.sudo()` to authorize a
 * single sudo-protected call without elevating the whole session. Sent as the
 * `nlv-sudo-nonce` header (never in the request body).
 *
 * Params of sudo-protected methods extend this; methods that take no other input
 * accept it directly.
 */
export interface Nonce {
  nonce?: string
}

export interface RevokeSessionParams extends Nonce {
  id: string
}

// ─── OAuth providers ──────────────────────────────────────────────────────────

export type OAuthProvider =
  | 'google'
  | 'github'
  | 'gitlab'
  | 'bitbucket'
  | 'facebook'
  | 'linked_in'
  | 'discord'
  | 'twitch'
  | 'slack'
  | 'azure'
  | 'apple'

// ─── User ─────────────────────────────────────────────────────────────────────

export type UserGender = 'male' | 'female' | 'other' | 'prefer_not_to_say'

export interface UserProfile {
  name?: string
  biography?: string
  gender?: UserGender
  avatar_uri?: string
  /** ISO date — YYYY-MM-DD */
  date_of_birth?: string
}

export interface User {
  id: string
  email?: string
  phone?: Phone
  username?: string
  profile?: UserProfile
  confirmed_at?: string
  is_confirmed?: boolean
  banned_at?: string
  is_banned?: boolean
  last_sign_in_at?: string
  identities?: Identity[]
  metadata?: Record<string, string | number>
  created_at?: string
  updated_at?: string
}

// ─── Sign-up / Sign-in ────────────────────────────────────────────────────────

/** At least one of `email`, `phone`, or `username` must be provided. */
export interface SignUpParams {
  email?: string
  phone?: Phone
  /** 3–30 chars: letters, numbers, dots, underscores */
  username?: string
  profile?: UserProfile
  password: string
  options?: AuthOptions
}

/** At least one of `email`, `phone`, or `username` must be provided. */
export interface SignInParams {
  email?: string
  phone?: Phone
  username?: string
  password: string
  options?: AuthOptions
}

/** At least one of `email` or `phone` must be provided. */
export interface SignInWithOTPParams {
  email?: string
  phone?: Phone
  options?: AuthOptions
}

/** At least one of `email`, `phone`, or `username` must be provided. */
export interface LookupParams {
  email?: string
  phone?: Phone
  username?: string
  options?: AuthOptions
}

export interface RefreshTokenParams {
  refresh_token: string
}

export interface RecoverParams {
  email: string
  options?: AuthOptions
}

export interface ResetPasswordParams {
  /** Token received via the recovery link/email. */
  token: string
  password: string
}

// ─── Challenge ────────────────────────────────────────────────────────────────

export type TokenType = 'bearer'

export type AssuranceLevel = 'aal1' | 'aal2' | 'aal3'

export type MFAMethod =
  | 'totp'
  | 'sms_otp'
  | 'email_otp'
  | 'recovery_codes'

export type ChallengeSubject =
  | 'sign_in_with_otp'
  | 'verify_pending_user'
  | 'sign_up'
  | 'add_email'
  | 'add_phone'
  | 'mfa'
  | 'sudo'

/** Methods accepted to elevate a session to sudo. Subset of `MFAMethod`. */
export type SudoMethod = 'totp' | 'email_otp' | 'sms_otp'

export interface Challenge {
  /** MFA method to present first to the user. */
  preferred: MFAMethod
  /** Masked identifier shown to the user — e.g. "u***@example.com". */
  identifier?: string
  factors: AuthMethod[]
  subject: ChallengeSubject
  /** Short-lived token used to continue the challenge flow. */
  token: string
  expires_in: number
}

export interface VerifyChallengeParams {
  /** Short-lived token from the `Challenge` object. */
  token: string
  /** OTP code, TOTP code, or recovery code entered by the user. */
  code: string
}

export interface ChangeChallengeParams {
  /** Short-lived token from the current `Challenge`. */
  token: string
  /** MFA method to switch to. */
  type: MFAMethod
}

// ─── Auth methods ─────────────────────────────────────────────────────────────

export type AuthFactorStatus = 'configured' | 'not_configured'

export interface AuthMethod {
  id?: string
  /** MFA method, sign-in method, or OAuth provider. */
  type: MFAMethod | SignInMethod | OAuthProvider
  name?: string
  status: AuthFactorStatus
  identifier?: string
  created_at?: string
  updated_at?: string
}

export interface AuthMethods {
  sign_in: AuthMethod[]
  mfas: AuthMethod[]
  oauth: AuthMethod[]
}

/** Returned by `auth.factors.enroll`. Pass `token` + `code` to `auth.factors.enable`. */
export interface FactorEnrollment {
  type: MFAMethod
  /** Short-lived token to pass to `factors.enable`. */
  token: string
  /** TOTP shared secret for manual entry. */
  secret?: string
  /** TOTP provisioning URL (useful for generating a QR code). */
  url?: string
}

export interface EnableFactorParams {
  /** Token received from `factors.enroll`. */
  token: string
  /** OTP or TOTP code to confirm enrollment. */
  code: string
}

export interface EnrollFactorParams extends Nonce {
  type: MFAMethod
  name?: string
}

export interface UnenrollFactorParams extends Nonce {
  id: string
}

// ─── Identities ───────────────────────────────────────────────────────────────

export type IdentityType = 'email' | 'phone' | 'oauth'

export interface Identity {
  id: string
  type: IdentityType
  provider_id?: string
  provider?: OAuthProvider
  identifier: string
  data?: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

export interface AddEmailIdentityParams extends Nonce {
  email: string
}

export interface AddPhoneIdentityParams extends Nonce {
  phone: Phone
}

export interface UpdateIdentityParams extends Nonce {
  id: string
  primary: boolean
}

export interface RemoveIdentityParams extends Nonce {
  id: string
}

export interface SendOTPToUpdateEmailParams extends Nonce {
  email: string
}

export interface SendOTPToUpdatePhoneParams extends Nonce {
  phone: Phone
}

// ─── Grants & Roles ──────────────────────────────────────────────────────

export type GrantStatus = 'granted' | 'invited' | 'requested' | 'blocked'

export interface Role {
  id: string
  name: string
  description?: string
  key: string
  context: string
  scopes: string[]
  cannot_scopes?: string[]
}

export interface Grant {
  id: string
  status: GrantStatus
  name?: string
  email?: string
  resource: string
  granted_to?: User
  role?: Role
  scopes: string[]
  cannot_scopes: string[]
  created_at?: string
  updated_at?: string
}

/** Grouped grants returned by `auth.grants.getMembers`. */
export interface GrantMembers {
  granted: Grant[]
  invitations: Grant[]
  requesteds: Grant[]
  blockeds: Grant[]
}

export interface Invite {
  email: string
  role_id?: string
  scopes?: string[]
  cannot_scopes?: string[]
}

export interface InviteParams extends Nonce {
  invites: Invite[]
  resource: string
  message?: string
}

export interface RevokeGrantParams extends Nonce {
  id: string
}

export interface BlockGrantParams extends Nonce {
  id: string
}

export interface UpdateGrantParams extends Nonce {
  scopes?: string[]
  cannot_scopes?: string[]
}

export interface LeaveGrantParams extends Nonce {
  id: string
}

// ─── Security ─────────────────────────────────────────────────────────────────

export interface ChangePasswordParams extends Nonce {
  password: string
  new_password: string
}

// ─── Platform ─────────────────────────────────────────────────────────────────

export interface PlatformInfo {
  id: string
  name: string
  slug: string
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export type PaginationSort = 'asc' | 'desc'

export interface Paginated<T> {
  items: T[]
  page?: number
  page_size?: number
  total?: number
  sort?: PaginationSort
}

export interface PaginateUsersParams {
  page?: number
  page_size?: number
  sort?: PaginationSort
  id?: string
  email?: string
  username?: string
  phone?: string
  is_confirmed?: boolean
  is_banned?: boolean
}

export interface PaginateGrantsParams {
  page?: number
  page_size?: number
  sort?: PaginationSort
  resource?: string
  context?: string
  granted_to_user_id?: string
  role_id?: string
}

export interface SetGrantParams {
  resource: string
  granted_to_user_id: string
  role_id?: string
  scopes?: string[]
  cannot_scopes?: string[]
}

export interface CreateRoleParams {
  name: string
  description?: string
  key: string
  context: string
  scopes: string[]
  cannot_scopes?: string[]
}

export interface UpdateRoleParams {
  name?: string
  description?: string
  scopes?: string[]
  cannot_scopes?: string[]
}

export interface AdminCreateUserParams {
  email?: string
  phone?: Phone
  username?: string
  profile?: UserProfile
  password?: string
  metadata?: Record<string, string | number>
  email_verified?: boolean
  phone_verified?: boolean
}

export interface AdminUpdateUserParams {
  username?: string
  profile?: UserProfile
  metadata?: Record<string, string | number | null>
}

// ─── Auth response ────────────────────────────────────────────────────────────

/**
 * Returned by `signUp`, `signIn`, `verifyChallenge`, and `refreshToken`.
 *
 * Check in this order:
 * 1. `access_token` present → authenticated.
 * 2. `challenge` present → MFA/OTP step required — call `verifyChallenge`.
 * 3. Only `user` present → pending confirmation (signUp only).
 */
export interface Authenticated {
  token_type?: TokenType
  access_token?: string
  refresh_token?: string
  expires_in?: number
  user?: User
  challenge?: Challenge
  /**
   * Present only when this authentication elevated the session to sudo
   * (e.g. resolving a sudo challenge via `challenges.verify`).
   */
  sudo?: {
    /** Seconds until sudo mode expires. */
    expires_in: number
  }
}

// ─── Lookup ───────────────────────────────────────────────────────────────────

export type SignInMethod =
  | 'email_password'
  | 'username_password'
  | 'phone_password'
  | 'email_otp'
  | 'sms_otp'

export type ConfirmationType = 'none' | 'link' | 'otp'

export type VerifyReason =
  | 'signin_with_otp'
  | 'verify_after_with_link'
  | 'requires_otp_for_registration'
  | 'waiting_confirmation_link'
  | 'confirmation_link_resent'
  | 'no_confirmation_required'

export interface LookupMatch {
  exists: boolean
  method: SignInMethod
  allowed_methods: SignInMethod[]
  confirmation_type: ConfirmationType
  reason?: VerifyReason
}

/**
 * Returned by `lookup`.
 * If `challenge` is present, proceed to `verifyChallenge`.
 */
export interface LookupResult {
  lookup: LookupMatch
  challenge?: Challenge
}

// ─── Session / verify ─────────────────────────────────────────────────────────

export type SignOutScope = 'global' | 'local' | 'others'

export interface VerifyParams {
  resource?: string
  scopes?: string[]
  roles?: string[]
  reject_assurance_level_error?: boolean
}

export interface Verified {
  user: { id: string }
  session: {
    id: string
    amr: Array<{ method: string; timestamp?: number }>
    scopes: string[]
    assurance_level: AssuranceLevel
    /** Whether sudo mode is currently active for the session. */
    sudo?: boolean
    /** Date-time until sudo mode expires. Null/absent when not elevated. */
    sudo_expires_at?: string | null
  }
}

export interface SessionFingerPrint {
  hash?: string
  ip?: string
  browser?: { name?: string; version?: string }
  engine?: { name?: string; version?: string }
  cpu?: { architecture?: string }
  os?: { name?: string; version?: string }
  device?: { name?: string; type?: string }
  location?: {
    country?: string
    region?: string
    timezone?: string
    city?: string
    position?: { lat?: number; lng?: number }
  }
}

export interface Session {
  id: string
  finger_print?: SessionFingerPrint
  amr: Array<{ method: string; timestamp?: number }>
  scopes: string[]
  aal: AssuranceLevel
  invalidated: boolean
  is_current_session: boolean
  created_at: string
  updated_at: string
  expires_at: string
  sudo_expires_at?: string | null
}

// ─── OAuth Server (project as OIDC provider) ──────────────────────────────────

export type OAuthAppType = 'public' | 'confidential'
export type OAuthAppTokenEndpointAuthMethod = 'none' | 'client_secret_basic' | 'client_secret_post'
export type OAuthAppGrantType = 'authorization_code' | 'refresh_token'

/** A registered third-party application (OAuth client) of the project. */
export interface OAuthApp {
  id: string
  client_id: string
  client_type: OAuthAppType
  token_endpoint_auth_method: OAuthAppTokenEndpointAuthMethod
  redirect_uris: string[]
  grant_types: OAuthAppGrantType[]
  client_name?: string
  client_uri?: string
  logo_uri?: string
  /** Only present right after create/regenerate (confidential apps). */
  client_secret?: string
  created_at?: string
  updated_at?: string
}

export interface RegisterOAuthAppParams {
  client_type: OAuthAppType
  token_endpoint_auth_method: OAuthAppTokenEndpointAuthMethod
  redirect_uris: string[]
  grant_types: OAuthAppGrantType[]
  client_name?: string
  client_uri?: string
  logo_uri?: string
}

/** `client_type` is immutable; the secret rotates via `regenerateSecret`. */
export interface UpdateOAuthAppParams {
  token_endpoint_auth_method?: OAuthAppTokenEndpointAuthMethod
  redirect_uris?: string[]
  grant_types?: OAuthAppGrantType[]
  client_name?: string
  client_uri?: string
  logo_uri?: string
}

/** Query parameters for the `/oauth/authorize` redirect (PKCE required, S256). */
export interface OAuthAuthorizeParams {
  client_id: string
  redirect_uri: string
  code_challenge: string
  code_challenge_method: 'S256'
  response_type?: 'code'
  scope?: string
  state?: string
  resource?: string
  nonce?: string
}

export interface ExchangeOAuthCodeParams {
  code: string
  code_verifier: string
  redirect_uri?: string
  client_id?: string
  /** Only for confidential clients. */
  client_secret?: string
  resource?: string
}

export interface RefreshOAuthTokenParams {
  refresh_token: string
  client_id?: string
  /** Only for confidential clients. */
  client_secret?: string
}

export interface OAuthTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope: string
  id_token?: string
}

export interface OAuthAuthorization {
  client: { id: string; name?: string; logo_uri?: string; uri?: string }
  scope: string[]
  auto_approved: boolean
  redirect?: { uri: string }
}

export type OAuthConsentAction = 'approve' | 'deny'

export interface OAuthConsentResult {
  redirect: { uri: string }
}

export interface OAuthUserInfo {
  sub: string
  email?: string
  email_verified?: boolean
  name?: string
  picture?: string
  preferred_username?: string
  phone_number?: string
  phone_number_verified?: boolean
}

/** An app the authenticated user has authorized. */
export interface OAuthUserGrant {
  client: { id: string; name?: string; logo_uri?: string; uri?: string }
  scopes: string[]
  granted_at: string
}

export interface OAuthDiscovery {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint: string
  jwks_uri: string
  registration_endpoint: string
  response_types_supported: string[]
  subject_types_supported: string[]
  id_token_signing_alg_values_supported: string[]
  scopes_supported: string[]
  token_endpoint_auth_methods_supported: string[]
  grant_types_supported: string[]
  code_challenge_methods_supported: string[]
}

export interface OAuthJWKS {
  keys: Array<Record<string, unknown>>
}
