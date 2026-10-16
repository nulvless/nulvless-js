import type { NulvlessStorage } from '../types'

/**
 * Persists in memory (plain `Map`). Data is lost on page reload.
 *
 * Useful for SSR environments, tests, or situations where persistent
 * storage is not available or desired.
 */
export class MemoryStorageAdapter implements NulvlessStorage {
  private readonly store = new Map<string, string>()

  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value)
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key)
  }
}
