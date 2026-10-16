import type { NulvlessStorage } from '../types'

/** Persists in `localStorage`. Data survives page reloads and browser restarts. */
export class LocalStorageAdapter implements NulvlessStorage {
  async getItem(key: string): Promise<string | null> {
    return localStorage.getItem(key)
  }

  async setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value)
  }

  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(key)
  }
}
