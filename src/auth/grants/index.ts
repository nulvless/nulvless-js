import { route } from '../../http'
import type { NulvlessResult, RequestOptions } from '../../types'
import type {
  BlockGrantParams,
  InviteParams,
  Grant,
  GrantMembers,
  LeaveGrantParams,
  RevokeGrantParams,
  UpdateGrantParams,
} from '../types'
import { AuthSubClient } from '../base'

/**
 * Grant management for the authenticated user.
 *
 * Available on `createServerClient` only (requires private key `sk_`).
 *
 * All methods require authentication. Pass `options.headers.Authorization` to
 * forward the user's bearer token on each server-side call.
 */
export class GrantsClient extends AuthSubClient {

  /**
   * Returns all grants granted to the authenticated user, optionally
   * filtered by context.
   */
  async list(context?: string, options?: RequestOptions): Promise<NulvlessResult<Grant[]>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    return this.http.get<Grant[]>('/grants', {
      ...options,
      headers: { ...options?.headers, ...auth.headers },
      ...(context ? { query: { context } } : {}),
    })
  }

  /**
   * Returns all grants for a given resource, grouped by status
   * (granted, invited, requested, blocked).
   *
   * The authenticated user must own or manage the resource.
   */
  async getMembers(resource: string, options?: RequestOptions): Promise<NulvlessResult<GrantMembers>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    return this.http.get<GrantMembers>('/grants/members', {
      ...options,
      headers: { ...options?.headers, ...auth.headers },
      query: { resource },
    })
  }

  /**
   * Creates grant invitations for one or more users on a resource.
   *
   * Each invite sends a notification to the target email address.
   *
   * Requires sudo: `MANAGE_GRANTS`.
   *
   * @example
   * await nulvless.auth.grants.invite({
   *   resource: 'project-123',
   *   invites: [{ email: 'user@example.com', scopes: ['read', 'write'] }],
   * })
   */
  async invite(params: InviteParams, options?: RequestOptions): Promise<NulvlessResult<Grant[]>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    const { nonce, ...body } = params
    return this.http.post<Grant[]>('/grants/invites', {
      ...body,
      ...(options?.redirect_uri ? { redirect_uri: options.redirect_uri } : {}),
    }, {
      ...options,
      nonce,
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  /**
   * Returns a single grant by ID.
   */
  async get(id: string, options?: RequestOptions): Promise<NulvlessResult<Grant>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    return this.http.get<Grant>(route`/grants/${id}`, {
      ...options,
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  /**
   * Revokes (removes) a grant.
   *
   * Requires sudo: `MANAGE_GRANTS`.
   */
  async revoke(params: RevokeGrantParams, options?: RequestOptions): Promise<NulvlessResult<Grant>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    const { nonce, id } = params
    return this.http.delete<Grant>(route`/grants/${id}/revoke`, {
      ...options,
      nonce,
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  /**
   * Accepts a pending invitation (`status: 'invited'`).
   */
  async accept(id: string, options?: RequestOptions): Promise<NulvlessResult<Grant>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    return this.http.patch<Grant>(route`/grants/${id}/accept`, undefined, {
      ...options,
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  /**
   * Cancels a pending invitation or request (`status: 'invited'` or `'requested'`).
   */
  async cancel(id: string, options?: RequestOptions): Promise<NulvlessResult<Grant>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    return this.http.patch<Grant>(route`/grants/${id}/cancel`, undefined, {
      ...options,
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  /**
   * Blocks a grant.
   *
   * Requires sudo: `MANAGE_GRANTS`.
   */
  async block(params: BlockGrantParams, options?: RequestOptions): Promise<NulvlessResult<Grant>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    const { nonce, id } = params
    return this.http.patch<Grant>(route`/grants/${id}/block`, undefined, {
      ...options,
      nonce,
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  /**
   * Updates the scopes of an existing grant.
   *
   * Requires sudo: `MANAGE_GRANTS`.
   */
  async update(id: string, params: UpdateGrantParams, options?: RequestOptions): Promise<NulvlessResult<Grant>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    const { nonce, ...body } = params
    return this.http.patch<Grant>(route`/grants/${id}`, body, {
      ...options,
      nonce,
      headers: { ...options?.headers, ...auth.headers },
    })
  }

  /**
   * Removes the authenticated user from a resource they were granted access to.
   *
   * Requires sudo: `MANAGE_GRANTS`.
   */
  async leave(params: LeaveGrantParams, options?: RequestOptions): Promise<NulvlessResult<Grant>> {
    const auth = await this.bearer(options)
    if (!auth.ok) return { data: null, error: auth.error }
    const { nonce, id } = params
    return this.http.patch<Grant>(route`/grants/${id}/leave`, undefined, {
      ...options,
      nonce,
      headers: { ...options?.headers, ...auth.headers },
    })
  }
}
