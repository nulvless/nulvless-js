import { SessionManager } from '../manager'
import { MemoryStorageAdapter } from '../../storage/adapters/memory'
import type { Authenticated } from '../../auth/types'
import type { NulvlessResult } from '../../types'

describe('SessionManager', () => {
  const sessionKey = 'nlv-test-token'

  function storedSession(overrides: Record<string, unknown> = {}): string {
    return JSON.stringify({
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      expires_at: Date.now() + 1000,
      token_type: 'bearer',
      ...overrides,
    })
  }

  function refreshed(token: string): NulvlessResult<Authenticated> {
    return {
      data: {
        access_token: token,
        refresh_token: `${token}-refresh`,
        expires_in: 3600,
        token_type: 'bearer',
      } as Authenticated,
      error: null,
    }
  }

  function failure(status: number, code: string): NulvlessResult<Authenticated> {
    return { data: null, error: { code, message: code, status_code: status } }
  }

  let storage: MemoryStorageAdapter
  let manager: SessionManager

  beforeEach(() => {
    storage = new MemoryStorageAdapter()
    manager = new SessionManager(storage, sessionKey)
  })

  it('renews once when several callers ask at the same time', async () => {
    await storage.setItem(sessionKey, storedSession())

    const refreshFn = jest.fn().mockResolvedValue(refreshed('access-2'))
    manager.setRefreshFn(refreshFn)

    const tokens = await Promise.all([
      manager.getValidToken(),
      manager.getValidToken(),
      manager.getValidToken(),
    ])

    expect(refreshFn).toHaveBeenCalledTimes(1)
    expect(tokens).toEqual(['access-2', 'access-2', 'access-2'])
  })

  it('serialises refreshes that start after one another', async () => {
    await storage.setItem(sessionKey, storedSession())

    const refreshFn = jest.fn().mockResolvedValue(refreshed('access-2'))
    manager.setRefreshFn(refreshFn)

    await manager.getValidToken()
    await manager.getValidToken()

    expect(refreshFn).toHaveBeenCalledTimes(1)
  })

  it('takes the token another context already stored instead of refreshing', async () => {
    await storage.setItem(sessionKey, storedSession({ access_token: 'access-from-other-tab' }))

    const refreshFn = jest.fn()
    manager.setRefreshFn(refreshFn)

    const token = await manager.forceRefresh({ expiredToken: 'access-1' })

    expect(token).toBe('access-from-other-tab')
    expect(refreshFn).not.toHaveBeenCalled()
  })

  it('keeps the session when the refresh cannot reach the server', async () => {
    await storage.setItem(sessionKey, storedSession())

    const onUnauthorized = jest.fn()
    manager.setOnUnauthorized(onUnauthorized)
    manager.setRefreshFn(jest.fn().mockResolvedValue(failure(0, 'network_error')))

    expect(await manager.getValidToken()).toBeNull()
    expect(await manager.get()).not.toBeNull()
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('retries a temporary failure and keeps the session on success', async () => {
    await storage.setItem(sessionKey, storedSession())

    const refreshFn = jest
      .fn()
      .mockResolvedValueOnce(failure(503, 'unavailable'))
      .mockResolvedValueOnce(refreshed('access-2'))

    manager.setRefreshFn(refreshFn)

    expect(await manager.getValidToken()).toBe('access-2')
    expect(refreshFn).toHaveBeenCalledTimes(2)
  })

  it('drops the session when the server refuses the refresh token', async () => {
    await storage.setItem(sessionKey, storedSession())

    const onUnauthorized = jest.fn()
    manager.setOnUnauthorized(onUnauthorized)
    manager.setRefreshFn(jest.fn().mockResolvedValue(failure(401, 'refresh_token_already_used')))

    expect(await manager.getValidToken()).toBeNull()
    expect(await manager.get()).toBeNull()
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('keeps the session when a soft refresh is refused', async () => {
    await storage.setItem(sessionKey, storedSession())

    const onUnauthorized = jest.fn()
    manager.setOnUnauthorized(onUnauthorized)
    manager.setRefreshFn(jest.fn().mockResolvedValue(failure(403, 'forbidden_resource_access')))

    expect(await manager.forceRefresh({ deauthOnFailure: false })).toBeNull()
    expect(await manager.get()).not.toBeNull()
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('does not refresh a token that is still far from expiring', async () => {
    await storage.setItem(sessionKey, storedSession({ expires_at: Date.now() + 3600_000 }))

    const refreshFn = jest.fn()
    manager.setRefreshFn(refreshFn)

    expect(await manager.getValidToken()).toBe('access-1')
    expect(refreshFn).not.toHaveBeenCalled()
  })

  it('does not start the renewal timer outside a browser', () => {
    const setIntervalSpy = jest.spyOn(globalThis, 'setInterval')

    manager.startAutoRefresh()

    expect(setIntervalSpy).not.toHaveBeenCalled()

    setIntervalSpy.mockRestore()
  })

  it('survives a scheduled renewal that throws', async () => {
    const browser = globalThis as unknown as Record<string, unknown>

    browser.window = {}
    browser.document = { hidden: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }

    jest.spyOn(storage, 'getItem').mockRejectedValue(new Error('no storage here'))
    jest.spyOn(console, 'error').mockImplementation(() => undefined)

    manager.startAutoRefresh()

    await expect(
      (manager as unknown as { tick: () => Promise<void> }).tick(),
    ).resolves.toBeUndefined()

    manager.stopAutoRefresh()

    delete browser.window
    delete browser.document
  })

  it('reports the lost session when there is no refresh token', async () => {
    await storage.setItem(sessionKey, storedSession({ refresh_token: undefined }))

    const onUnauthorized = jest.fn()
    manager.setOnUnauthorized(onUnauthorized)
    manager.setRefreshFn(jest.fn())

    expect(await manager.getValidToken()).toBeNull()
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })
})

describe('SessionManager storage', () => {
  const sessionKey = 'nlv-test-token'
  let storage: MemoryStorageAdapter
  let manager: SessionManager

  beforeEach(() => {
    storage = new MemoryStorageAdapter()
    manager = new SessionManager(storage, sessionKey)
  })

  it('fills in an hour of validity and the bearer type when the response omits them', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000)

    await manager.save({ access_token: 'at' })

    expect(await manager.get()).toEqual({ access_token: 'at', expires_at: 3_601_000, token_type: 'bearer' })
  })

  it('stores nothing for a response without an access token', async () => {
    await manager.save({ user: { id: 'user-1' } })

    expect(await manager.get()).toBeNull()
  })

  it('treats a corrupt stored session as no session', async () => {
    await storage.setItem(sessionKey, 'not json')

    expect(await manager.get()).toBeNull()
  })

  it('clears the stored session', async () => {
    await manager.save({ access_token: 'at' })
    await manager.clear()

    expect(await manager.get()).toBeNull()
  })

  it('reports a forced refresh without any session as unauthorized', async () => {
    const onUnauthorized = jest.fn()
    manager.setOnUnauthorized(onUnauthorized)

    expect(await manager.forceRefresh()).toBeNull()
    expect(onUnauthorized).toHaveBeenCalledWith(null)
  })

  it('renews a token that is still valid when forced', async () => {
    await manager.save({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 })
    const onTokenRefreshed = jest.fn()
    manager.setOnTokenRefreshed(onTokenRefreshed)
    manager.setRefreshFn(async () => ({ data: { access_token: 'renewed' }, error: null }))

    expect(await manager.forceRefresh()).toBe('renewed')
    expect(onTokenRefreshed).toHaveBeenCalledWith({ access_token: 'renewed' })
  })

  it('gives up after the retries on temporary failures are exhausted', async () => {
    jest.useFakeTimers()
    await storage.setItem(sessionKey, JSON.stringify({ access_token: 'at', refresh_token: 'rt', expires_at: 0, token_type: 'bearer' }))
    const refreshFn = jest.fn().mockResolvedValue({ data: null, error: { code: 'unavailable', message: '', status_code: 503 } })
    manager.setRefreshFn(refreshFn)

    const token = manager.getValidToken()
    await jest.runAllTimersAsync()

    expect(await token).toBeNull()
    expect(refreshFn).toHaveBeenCalledTimes(4)
    expect(await manager.get()).not.toBeNull()
    jest.useRealTimers()
  })
})

describe('SessionManager auto refresh', () => {
  const sessionKey = 'nlv-test-token'
  const browser = globalThis as unknown as Record<string, unknown>
  let document: { hidden: boolean; addEventListener: jest.Mock; removeEventListener: jest.Mock }
  let storage: MemoryStorageAdapter
  let manager: SessionManager
  let refreshFn: jest.Mock

  beforeEach(async () => {
    jest.useFakeTimers()
    document = { hidden: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }
    browser.window = {}
    browser.document = document
    storage = new MemoryStorageAdapter()
    manager = new SessionManager(storage, sessionKey)
    refreshFn = jest.fn().mockResolvedValue({ data: { access_token: 'renewed', expires_in: 3600 }, error: null })
    manager.setRefreshFn(refreshFn)
  })

  afterEach(() => {
    manager.stopAutoRefresh()
    jest.useRealTimers()
    delete browser.window
    delete browser.document
  })

  async function storeSessionExpiringIn(ms: number): Promise<void> {
    await storage.setItem(
      sessionKey,
      JSON.stringify({ access_token: 'at', refresh_token: 'rt', expires_at: Date.now() + ms, token_type: 'bearer' }),
    )
  }

  it('renews a token that is about to expire on the next tick', async () => {
    await storeSessionExpiringIn(60_000)

    manager.startAutoRefresh()
    await jest.advanceTimersByTimeAsync(30_000)

    expect(refreshFn).toHaveBeenCalledWith('rt')
    expect((await manager.get())?.access_token).toBe('renewed')
  })

  it('leaves a token far from expiry alone', async () => {
    await storeSessionExpiringIn(3_600_000)

    manager.startAutoRefresh()
    await jest.advanceTimersByTimeAsync(30_000)

    expect(refreshFn).not.toHaveBeenCalled()
  })

  it('does not renew while the page is hidden', async () => {
    await storeSessionExpiringIn(60_000)
    document.hidden = true

    manager.startAutoRefresh()
    await jest.advanceTimersByTimeAsync(30_000)

    expect(refreshFn).not.toHaveBeenCalled()
  })

  it('renews as soon as the page becomes visible again', async () => {
    await storeSessionExpiringIn(60_000)
    manager.startAutoRefresh()
    const onVisibilityChange = document.addEventListener.mock.calls[0]?.[1] as () => void

    onVisibilityChange()
    await jest.advanceTimersByTimeAsync(0)

    expect(refreshFn).toHaveBeenCalledTimes(1)
  })

  it('starts a single timer however many times it is asked', () => {
    const setIntervalSpy = jest.spyOn(globalThis, 'setInterval')

    manager.startAutoRefresh()
    manager.startAutoRefresh()

    expect(setIntervalSpy).toHaveBeenCalledTimes(1)
  })

  it('stops ticking and listening once stopped', async () => {
    await storeSessionExpiringIn(60_000)
    manager.startAutoRefresh()

    manager.stopAutoRefresh()
    await jest.advanceTimersByTimeAsync(60_000)

    expect(refreshFn).not.toHaveBeenCalled()
    expect(document.removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })
})
