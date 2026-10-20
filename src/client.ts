import { HttpClient } from './http'
import type { ClientOptions, ServerClientOptions } from './types'
import { AuthBrowserClient, AuthServerClient } from './auth'
import { CommsClient } from './comms'
import { SessionManager } from './session/manager'
import { MemoryStorageAdapter, Storage } from './storage'
import type { NulvlessStorage } from './storage/types'

function defaultStorage(): NulvlessStorage {
  return typeof window !== 'undefined' ? Storage.Local : new MemoryStorageAdapter()
}

/**
 * Browser client — use with a public key (`pk_...`).
 *
 * Only exposes endpoints that accept public keys.
 * Safe to instantiate in frontend code.
 */
export class NulvlessClient {
  readonly auth: AuthBrowserClient

  constructor(baseUrl: string, publicKey: string, options?: ClientOptions) {
    const base = baseUrl.replace(/\/+$/, '')
    const subdomain = new URL(base).hostname.split('.')[0] ?? 'app'
    const tokenKey = options?.storageKeys?.token ?? `nlv-${subdomain}-token`
    const accountsKey = options?.storageKeys?.accounts ?? `${tokenKey}-accounts`
    const storage = options?.storage ?? defaultStorage()
    const session = new SessionManager(storage, tokenKey)
    this.auth = new AuthBrowserClient(
      new HttpClient({
        baseUrl: `${base}/auth`,
        apiKey: publicKey,
        ...options,
        onTokenExpired: ({ deauthOnFailure, expiredToken }) =>
          session.forceRefresh({
            deauthOnFailure,
            ...(expiredToken ? { expiredToken } : {}),
          }),
      }),
      session,
      storage,
      accountsKey,
      options?.multiUser ?? false,
      options?.autoRefresh ?? true,
    )
  }
}

/**
 * Server client — use with a private key (`sk_...`).
 *
 * Has access to everything in `NulvlessClient` plus private-only endpoints.
 * Never instantiate in browser code — the private key must stay secret.
 */
export class NulvlessServerClient {
  readonly auth: AuthServerClient
  readonly comms: CommsClient

  constructor(baseUrl: string, privateKey: string, options?: ServerClientOptions) {
    const base = baseUrl.replace(/\/+$/, '')
    this.auth = new AuthServerClient(new HttpClient({ baseUrl: `${base}/auth`, apiKey: privateKey, ...options }))
    this.comms = new CommsClient(new HttpClient({ baseUrl: `${base}/comms`, apiKey: privateKey, ...options }))
  }
}
