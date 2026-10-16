import { CacheStorageAdapter, LocalStorageAdapter, MemoryStorageAdapter, SessionStorageAdapter, Storage } from '../index'
import type { NulvlessStorage } from '../types'

class FakeWebStorage {
  private readonly items = new Map<string, string>()

  getItem(key: string): string | null {
    return this.items.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value)
  }

  removeItem(key: string): void {
    this.items.delete(key)
  }
}

class FakeCacheStorage {
  readonly caches = new Map<string, Map<string, Response>>()

  async open(name: string) {
    const entries = this.caches.get(name) ?? new Map<string, Response>()
    this.caches.set(name, entries)

    return {
      match: async (url: string) => entries.get(url)?.clone(),
      put: async (url: string, response: Response) => {
        entries.set(url, response)
      },
      delete: async (url: string) => entries.delete(url),
    }
  }
}

const browserGlobals = globalThis as Record<string, unknown>

beforeEach(() => {
  browserGlobals['localStorage'] = new FakeWebStorage()
  browserGlobals['sessionStorage'] = new FakeWebStorage()
  browserGlobals['caches'] = new FakeCacheStorage()
})

afterEach(() => {
  delete browserGlobals['localStorage']
  delete browserGlobals['sessionStorage']
  delete browserGlobals['caches']
})

describe.each<[string, () => NulvlessStorage]>([
  ['MemoryStorageAdapter', () => new MemoryStorageAdapter()],
  ['LocalStorageAdapter', () => new LocalStorageAdapter()],
  ['SessionStorageAdapter', () => new SessionStorageAdapter()],
  ['CacheStorageAdapter', () => new CacheStorageAdapter()],
])('%s', (_name, makeStorage) => {
  it('returns null for a key that was never set', async () => {
    await expect(makeStorage().getItem('missing')).resolves.toBeNull()
  })

  it('reads back what was written', async () => {
    const storage = makeStorage()

    await storage.setItem('key', 'value')

    await expect(storage.getItem('key')).resolves.toBe('value')
  })

  it('overwrites an existing value', async () => {
    const storage = makeStorage()

    await storage.setItem('key', 'first')
    await storage.setItem('key', 'second')

    await expect(storage.getItem('key')).resolves.toBe('second')
  })

  it('forgets a removed key', async () => {
    const storage = makeStorage()

    await storage.setItem('key', 'value')
    await storage.removeItem('key')

    await expect(storage.getItem('key')).resolves.toBeNull()
  })
})

describe('LocalStorageAdapter and SessionStorageAdapter', () => {
  it('write to their own browser storage', async () => {
    await new LocalStorageAdapter().setItem('key', 'local')
    await new SessionStorageAdapter().setItem('key', 'session')

    expect((browserGlobals['localStorage'] as FakeWebStorage).getItem('key')).toBe('local')
    expect((browserGlobals['sessionStorage'] as FakeWebStorage).getItem('key')).toBe('session')
  })
})

describe('CacheStorageAdapter', () => {
  it('keeps keys with special characters apart', async () => {
    const storage = new CacheStorageAdapter()

    await storage.setItem('a/b', 'slash')
    await storage.setItem('a?b', 'question')

    await expect(storage.getItem('a/b')).resolves.toBe('slash')
    await expect(storage.getItem('a?b')).resolves.toBe('question')
  })
})

describe('Storage', () => {
  it('exposes one adapter of each kind', () => {
    expect(Storage.Local).toBeInstanceOf(LocalStorageAdapter)
    expect(Storage.Session).toBeInstanceOf(SessionStorageAdapter)
    expect(Storage.Memory).toBeInstanceOf(MemoryStorageAdapter)
    expect(Storage.Cache).toBeInstanceOf(CacheStorageAdapter)
  })

  it('can be imported where browser storage does not exist', () => {
    delete browserGlobals['localStorage']

    expect(() => new LocalStorageAdapter()).not.toThrow()
  })
})
