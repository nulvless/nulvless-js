export { NulvlessClient, NulvlessServerClient } from './client'
export { AuthClient, AuthBrowserClient, AuthServerClient } from './auth'
export type { AccountEntry } from './auth/accounts'
export { AuthEventEmitter } from './auth/emitter'
export type { AuthEvents } from './auth/emitter'
export { FactorsClient } from './auth/factors'
export { UsersClient } from './auth/users'
export { SessionsClient } from './auth/sessions'
export { SecurityClient } from './auth/security'
export { GrantsClient } from './auth/grants'
export { OAuthClient, OAuthGrantsClient } from './auth/oauth'
export { AdminClient } from './auth/admin'
export { CommsClient, EmailClient, SmsClient } from './comms'
export { TemplatesClient } from './comms/templates'
export { HttpClient } from './http'
export { NulvlessException } from './exceptions/nulvless.exception'
export { Storage } from './storage'
export { forwardUserHeaders } from './helpers/forward-user-headers'
export { applyAuthCacheHeaders, AUTH_CACHE_HEADERS } from './helpers/auth-cache-headers'
export { SessionManager } from './session/manager'
export type { NulvlessStorage } from './storage/types'
export type { StoredSession } from './session/types'
export type * from './types'
export type * from './auth/types'
export type * from './comms/types'

import type { ClientOptions, ServerClientOptions } from './types'
import { NulvlessClient, NulvlessServerClient } from './client'

/**
 * Creates a browser-safe client using a public key (`pk_...`).
 *
 * Exposes: `.auth`
 *
 * @example
 * import { createClient } from '@nulvless/nulvless-js'
 *
 * const nulvless = createClient('https://auth.example.com', 'pk_live_...')
 *
 * const { data, error } = await nulvless.auth.signIn({
 *   email: 'user@example.com',
 *   password: 'secret',
 * })
 */
export function createClient(
  url: string,
  publicKey: string,
  options?: ClientOptions,
): NulvlessClient {
  return new NulvlessClient(url, publicKey, options)
}

/**
 * Creates a server-side client using a private key (`sk_...`).
 * Never use this in browser code.
 *
 * Exposes: `.auth`, `.comms`
 *
 * @example
 * import { createServerClient } from '@nulvless/nulvless-js'
 *
 * const nulvless = createServerClient('https://api.example.com', 'sk_live_...')
 *
 * const { error } = await nulvless.comms.email.send({
 *   to: 'user@example.com',
 *   template: 'welcome',
 *   params: { name: 'Gleisson' },
 * })
 */
export function createServerClient(
  url: string,
  privateKey: string,
  options?: ServerClientOptions,
): NulvlessServerClient {
  return new NulvlessServerClient(url, privateKey, options)
}
