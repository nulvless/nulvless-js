/**
 * Storage adapter interface used by the SDK to persist session tokens.
 *
 * All methods are async to support both synchronous storages (localStorage)
 * and asynchronous ones (Cache Storage API, IndexedDB, etc.).
 */
export interface NulvlessStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}
