export type { NulvlessStorage } from './types'
export { LocalStorageAdapter } from './adapters/local'
export { SessionStorageAdapter } from './adapters/session'
export { MemoryStorageAdapter } from './adapters/memory'
export { CacheStorageAdapter } from './adapters/cache'

import { LocalStorageAdapter } from './adapters/local'
import { SessionStorageAdapter } from './adapters/session'
import { MemoryStorageAdapter } from './adapters/memory'
import { CacheStorageAdapter } from './adapters/cache'

/**
 * Built-in storage adapters for session persistence.
 *
 * @example
 * import { Storage } from '@nulvless/nulvless-js'
 *
 * const nulvless = createClient(url, key, {
 *   storage: Storage.Local,   // localStorage — survives reloads
 *   storage: Storage.Session, // sessionStorage — cleared on tab close
 *   storage: Storage.Memory,  // in-memory — useful for SSR / tests
 *   storage: Storage.Cache,   // Cache Storage API — browser / service workers
 * })
 */
export const Storage = {
  /** `localStorage` — data survives page reloads and browser restarts. */
  Local: new LocalStorageAdapter(),
  /** `sessionStorage` — data is cleared when the tab or browser is closed. */
  Session: new SessionStorageAdapter(),
  /** In-memory `Map` — data is lost on page reload. Good for SSR and tests. */
  Memory: new MemoryStorageAdapter(),
  /** Cache Storage API — survives reloads, available in service workers. */
  Cache: new CacheStorageAdapter(),
} as const
