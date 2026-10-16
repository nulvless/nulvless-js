import type { NulvlessStorage } from '../types'

const CACHE_NAME = 'nulvless'

/**
 * Persists using the browser's Cache Storage API.
 *
 * Available in modern browsers and service workers. Data survives page
 * reloads but can be cleared by the browser under storage pressure.
 *
 * Keys are mapped to fake URLs (`https://nulvless.storage/<key>`) since
 * the Cache API uses URLs as identifiers.
 */
export class CacheStorageAdapter implements NulvlessStorage {
  private key(k: string): string {
    return `https://nulvless.storage/${encodeURIComponent(k)}`
  }

  async getItem(key: string): Promise<string | null> {
    const cache = await caches.open(CACHE_NAME)
    const response = await cache.match(this.key(key))
    return response ? response.text() : null
  }

  async setItem(key: string, value: string): Promise<void> {
    const cache = await caches.open(CACHE_NAME)
    await cache.put(this.key(key), new Response(value))
  }

  async removeItem(key: string): Promise<void> {
    const cache = await caches.open(CACHE_NAME)
    await cache.delete(this.key(key))
  }
}
