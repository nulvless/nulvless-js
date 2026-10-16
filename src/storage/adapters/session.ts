import type { NulvlessStorage } from '../types'

/** Persists in `sessionStorage`. Data is cleared when the tab or browser is closed. */
export class SessionStorageAdapter implements NulvlessStorage {
  async getItem(key: string): Promise<string | null> {
    return sessionStorage.getItem(key)
  }

  async setItem(key: string, value: string): Promise<void> {
    sessionStorage.setItem(key, value)
  }

  async removeItem(key: string): Promise<void> {
    sessionStorage.removeItem(key)
  }
}
