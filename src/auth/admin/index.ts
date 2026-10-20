import type { HttpClient } from '../../http'
import { route } from '../../http'
import type { NulvlessResult, RequestOptions } from '../../types'
import type {
  AdminCreateUserParams,
  AdminUpdateUserParams,
  AuthMethod,
  CreateRoleParams,
  OAuthApp,
  Paginated,
  PaginateGrantsParams,
  PaginateUsersParams,
  Grant,
  RegisterOAuthAppParams,
  Role,
  Session,
  SetGrantParams,
  UpdateOAuthAppParams,
  UpdateRoleParams,
  User,
} from '../types'

/**
 * Admin operations on platform users.
 * Requires private key (`sk_`). No bearer token needed.
 */
class AdminUsersClient {
  constructor(private readonly http: HttpClient) {}

  /**
   * Creates a new user bypassing normal sign-up flows.
   */
  create(params: AdminCreateUserParams, options?: RequestOptions): Promise<NulvlessResult<User>> {
    return this.http.post<User>('/admin/users', params, options)
  }

  /**
   * Lists users with pagination and optional filters.
   */
  list(params?: PaginateUsersParams, options?: RequestOptions): Promise<NulvlessResult<Paginated<User>>> {
    return this.http.get<Paginated<User>>('/admin/users', {
      ...options,
      ...(params ? { query: params as Record<string, string | number | boolean> } : {}),
    })
  }

  /**
   * Returns a single user by ID.
   */
  get(userId: string, options?: RequestOptions): Promise<NulvlessResult<User>> {
    return this.http.get<User>(route`/admin/users/${userId}`, options)
  }

  /**
   * Updates a user's profile fields.
   */
  update(userId: string, params: AdminUpdateUserParams, options?: RequestOptions): Promise<NulvlessResult<User>> {
    return this.http.patch<User>(route`/admin/users/${userId}`, params, options)
  }

  /**
   * Permanently deletes a user.
   */
  delete(userId: string, options?: RequestOptions): Promise<NulvlessResult<User>> {
    return this.http.delete<User>(route`/admin/users/${userId}`, options)
  }

  /**
   * Bans a user, preventing them from signing in.
   */
  ban(userId: string, options?: RequestOptions): Promise<NulvlessResult<User>> {
    return this.http.patch<User>(route`/admin/users/${userId}/ban`, undefined, options)
  }

  /**
   * Lifts a ban on a user.
   */
  unban(userId: string, options?: RequestOptions): Promise<NulvlessResult<User>> {
    return this.http.patch<User>(route`/admin/users/${userId}/unban`, undefined, options)
  }

  /**
   * Returns all active sessions for a specific user.
   */
  getSessions(userId: string, options?: RequestOptions): Promise<NulvlessResult<Session[]>> {
    return this.http.get<Session[]>(route`/admin/users/${userId}/sessions`, options)
  }

  /**
   * Invalidates all sessions for a specific user (signs them out everywhere).
   */
  signOutAll(userId: string, options?: RequestOptions): Promise<NulvlessResult<null>> {
    return this.http.delete<null>(route`/admin/users/${userId}/sessions`, options)
  }

  /**
   * Invalidates a specific session for a user.
   */
  revokeSession(userId: string, sessionId: string, options?: RequestOptions): Promise<NulvlessResult<Session>> {
    return this.http.delete<Session>(route`/admin/users/${userId}/sessions/${sessionId}`, options)
  }

  /**
   * Returns all configured MFA factors for a specific user.
   */
  getFactors(userId: string, options?: RequestOptions): Promise<NulvlessResult<AuthMethod[]>> {
    return this.http.get<AuthMethod[]>(route`/admin/users/${userId}/factors`, options)
  }

  /**
   * Removes a specific MFA factor from a user.
   */
  removeFactor(userId: string, factorId: string, options?: RequestOptions): Promise<NulvlessResult<null>> {
    return this.http.delete<null>(route`/admin/users/${userId}/factors/${factorId}`, options)
  }
}

/**
 * Role management. Requires private key (`sk_`). No bearer token needed.
 */
class AdminRolesClient {
  constructor(private readonly http: HttpClient) {}

  /**
   * Returns all roles, optionally filtered by context.
   */
  list(context?: string, options?: RequestOptions): Promise<NulvlessResult<Role[]>> {
    return this.http.get<Role[]>('/admin/roles', {
      ...options,
      ...(context ? { query: { context } } : {}),
    })
  }

  /**
   * Creates a new role with the given scopes.
   */
  create(params: CreateRoleParams, options?: RequestOptions): Promise<NulvlessResult<Role>> {
    return this.http.post<Role>('/admin/roles', params, options)
  }

  /**
   * Updates an existing role.
   */
  update(role_id: string, params: UpdateRoleParams, options?: RequestOptions): Promise<NulvlessResult<Role>> {
    return this.http.patch<Role>(route`/admin/roles/${role_id}`, params, options)
  }

  /**
   * Deletes a role.
   */
  delete(role_id: string, options?: RequestOptions): Promise<NulvlessResult<null>> {
    return this.http.delete<null>(route`/admin/roles/${role_id}`, options)
  }
}

/**
 * Platform-level grant management.
 * Requires private key (`sk_`). No bearer token needed.
 */
class AdminGrantsClient {
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists grants with pagination and optional filters.
   */
  list(params?: PaginateGrantsParams, options?: RequestOptions): Promise<NulvlessResult<Paginated<Grant>>> {
    return this.http.get<Paginated<Grant>>('/admin/grants', {
      ...options,
      ...(params ? { query: params as Record<string, string | number | boolean> } : {}),
    })
  }

  /**
   * Creates or upserts a grant for a user on a resource.
   */
  set(params: SetGrantParams, options?: RequestOptions): Promise<NulvlessResult<Grant>> {
    return this.http.post<Grant>('/admin/grants', params, options)
  }

  /**
   * Deletes a grant by ID.
   */
  delete(grantId: string, options?: RequestOptions): Promise<NulvlessResult<null>> {
    return this.http.delete<null>(route`/admin/grants/${grantId}`, options)
  }

  /**
   * Removes all grants associated with a resource.
   *
   * Use with caution — this will revoke access for all users on the resource.
   */
  deleteByResource(resource: string, options?: RequestOptions): Promise<NulvlessResult<null>> {
    return this.http.delete<null>(route`/admin/resources/${resource}/grants`, options)
  }
}

/**
 * Manage the project's OAuth applications (clients) — the third-party apps
 * allowed to authenticate users through the project's OAuth server.
 *
 * Requires private key (`sk_`). No bearer token needed.
 */
class AdminOAuthClientsClient {
  constructor(private readonly http: HttpClient) {}

  /**
   * Registers a new OAuth app. For confidential apps the response includes a
   * one-time `client_secret` — store it securely, it is never returned again.
   */
  create(params: RegisterOAuthAppParams, options?: RequestOptions): Promise<NulvlessResult<OAuthApp>> {
    return this.http.post<OAuthApp>('/admin/oauth/clients', params, options)
  }

  /**
   * Lists all registered OAuth apps.
   */
  list(options?: RequestOptions): Promise<NulvlessResult<OAuthApp[]>> {
    return this.http.get<OAuthApp[]>('/admin/oauth/clients', options)
  }

  /**
   * Returns a single OAuth app by its internal id.
   */
  get(id: string, options?: RequestOptions): Promise<NulvlessResult<OAuthApp>> {
    return this.http.get<OAuthApp>(route`/admin/oauth/clients/${id}`, options)
  }

  /**
   * Updates an OAuth app. `client_type` is immutable and the secret rotates via
   * `regenerateSecret` — neither can be changed here.
   */
  update(id: string, params: UpdateOAuthAppParams, options?: RequestOptions): Promise<NulvlessResult<OAuthApp>> {
    return this.http.put<OAuthApp>(route`/admin/oauth/clients/${id}`, params, options)
  }

  /**
   * Deletes an OAuth app.
   */
  delete(id: string, options?: RequestOptions): Promise<NulvlessResult<null>> {
    return this.http.delete<null>(route`/admin/oauth/clients/${id}`, options)
  }

  /**
   * Rotates the client secret (confidential apps only). The new `client_secret`
   * is returned once — the previous one stops working immediately.
   */
  regenerateSecret(id: string, options?: RequestOptions): Promise<NulvlessResult<OAuthApp>> {
    return this.http.post<OAuthApp>(route`/admin/oauth/clients/${id}/regenerate_secret`, undefined, options)
  }
}

/**
 * Admin namespace — platform management operations.
 *
 * Available on `createServerClient` only (requires private key `sk_`).
 * No bearer token is required for any method in this namespace.
 *
 * Sub-namespaces:
 * - `admin.users` — create, list, update, delete users; manage sessions & factors
 * - `admin.roles` — create, list, update, delete roles
 * - `admin.grants` — set, list, delete platform grants
 * - `admin.oauthClients` — register and manage OAuth apps (clients)
 */
export class AdminClient {
  readonly users: AdminUsersClient
  readonly roles: AdminRolesClient
  readonly grants: AdminGrantsClient
  readonly oauthClients: AdminOAuthClientsClient

  constructor(private readonly http: HttpClient) {
    this.users = new AdminUsersClient(http)
    this.roles = new AdminRolesClient(http)
    this.grants = new AdminGrantsClient(http)
    this.oauthClients = new AdminOAuthClientsClient(http)
  }
}
