import { createClient, createServerClient } from '../index'
import { NulvlessClient, NulvlessServerClient } from '../client'
import { AuthBrowserClient, AuthServerClient } from '../auth'
import { CommsClient } from '../comms'
import { Storage } from '../storage'
import { MemoryStorageAdapter } from '../storage/adapters/memory'
import { mockFetch } from './support/fetch'

describe('createClient', () => {
  it('returns a NulvlessClient instance', () => {
    const client = createClient('https://app.nulvless.co', 'pk_test', { storage: Storage.Memory })
    expect(client).toBeInstanceOf(NulvlessClient)
  })

  it('exposes auth as AuthBrowserClient', () => {
    const client = createClient('https://app.nulvless.co', 'pk_test', { storage: Storage.Memory })
    expect(client.auth).toBeInstanceOf(AuthBrowserClient)
  })

  it('does not expose comms', () => {
    const client = createClient('https://app.nulvless.co', 'pk_test', { storage: Storage.Memory })
    expect((client as unknown as Record<string, unknown>)['comms']).toBeUndefined()
  })

  it('uses custom storage keys when storageKeys is provided', () => {
    const client = createClient('https://app.nulvless.co', 'pk_test', {
      storage: Storage.Memory,
      storageKeys: { token: 'my-session', accounts: 'my-accounts' },
    })
    expect(client.auth).toBeInstanceOf(AuthBrowserClient)
  })
})

describe('createServerClient', () => {
  it('returns a NulvlessServerClient instance', () => {
    const client = createServerClient('https://app.nulvless.co', 'sk_test')
    expect(client).toBeInstanceOf(NulvlessServerClient)
  })

  it('exposes auth as AuthServerClient', () => {
    const client = createServerClient('https://app.nulvless.co', 'sk_test')
    expect(client.auth).toBeInstanceOf(AuthServerClient)
  })

  it('exposes comms as CommsClient', () => {
    const client = createServerClient('https://app.nulvless.co', 'sk_test')
    expect(client.comms).toBeInstanceOf(CommsClient)
  })

  it('does not expose a session (server clients are stateless)', () => {
    const client = createServerClient('https://app.nulvless.co', 'sk_test')
    expect((client as unknown as Record<string, unknown>)['session']).toBeUndefined()
  })
})

describe('client wiring', () => {
  const browserGlobals = globalThis as Record<string, unknown>

  afterEach(() => {
    delete browserGlobals['window']
    delete browserGlobals['document']
    delete browserGlobals['localStorage']
  })

  it('routes auth calls to /auth and comms calls to /notifications', async () => {
    const { requests } = mockFetch()
    const client = createServerClient('https://app.nulvless.co/', 'sk_test')

    await client.auth.lookup({ email: 'a@b.co' })
    await client.comms.email.test('a@b.co')

    expect(requests.map(request => request.url.pathname)).toEqual([
      '/auth/lookup',
      '/notifications/notifications/test/email',
    ])
    expect(requests.every(request => request.headers['x-platform-key'] === 'sk_test')).toBe(true)
  })

  it('stores the session under keys derived from the project subdomain', async () => {
    const storage = new MemoryStorageAdapter()
    const client = createClient('https://my-project.nulvless.co', 'pk_test', { storage, multiUser: true })

    await client.auth.set({ access_token: 'at', user: { id: 'user-1' } })
    await client.auth.add({ access_token: 'at', user: { id: 'user-1' } })

    expect(await storage.getItem('nlv-my-project-token')).not.toBeNull()
    expect(await storage.getItem('nlv-my-project-token-accounts')).not.toBeNull()
  })

  it('uses the custom storage keys when given', async () => {
    const storage = new MemoryStorageAdapter()
    const client = createClient('https://app.nulvless.co', 'pk_test', {
      storage,
      multiUser: true,
      storageKeys: { token: 'my-session', accounts: 'my-accounts' },
    })

    await client.auth.set({ access_token: 'at', user: { id: 'user-1' } })
    await client.auth.add({ access_token: 'at', user: { id: 'user-1' } })

    expect(await storage.getItem('my-session')).not.toBeNull()
    expect(await storage.getItem('my-accounts')).not.toBeNull()
  })

  it('keeps sessions of separate clients apart outside the browser', async () => {
    const first = createClient('https://app.nulvless.co', 'pk_test')
    const second = createClient('https://app.nulvless.co', 'pk_test')

    await first.auth.set({ access_token: 'at' })

    expect(await second.auth.get()).toBeNull()
  })

  it('persists in localStorage in the browser by default', async () => {
    const setItem = jest.fn()
    browserGlobals['window'] = {}
    browserGlobals['localStorage'] = { setItem }

    await createClient('https://app.nulvless.co', 'pk_test').auth.set({ access_token: 'at' })

    expect(setItem).toHaveBeenCalledWith('nlv-app-token', expect.stringContaining('"access_token":"at"'))
  })

  it('renews the session on a timer in the browser unless autoRefresh is off', () => {
    browserGlobals['window'] = {}
    browserGlobals['document'] = { addEventListener: jest.fn(), removeEventListener: jest.fn() }
    const setIntervalSpy = jest.spyOn(globalThis, 'setInterval')
    const storage = new MemoryStorageAdapter()

    createClient('https://app.nulvless.co', 'pk_test', { storage, autoRefresh: false }).auth.dispose()
    expect(setIntervalSpy).not.toHaveBeenCalled()

    createClient('https://app.nulvless.co', 'pk_test', { storage }).auth.dispose()
    expect(setIntervalSpy).toHaveBeenCalledTimes(1)
  })
})
