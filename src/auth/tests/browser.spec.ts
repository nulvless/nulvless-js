import { createClient } from '../../index'
import type { NulvlessClient } from '../../client'
import type { ClientOptions } from '../../types'
import type { Authenticated } from '../types'
import { MemoryStorageAdapter } from '../../storage/adapters/memory'
import { failWith, mockFetch, reply } from '../../tests/support/fetch'
import { jwt } from '../../tests/support/tokens'

const url = 'https://app.nulvless.co'

function signedIn(userId = 'user-1', overrides: Partial<Authenticated> = {}): Authenticated {
  return {
    access_token: jwt({ sub: userId }),
    refresh_token: `${userId}-refresh`,
    expires_in: 3600,
    token_type: 'bearer',
    user: { id: userId },
    ...overrides,
  }
}

describe('AuthBrowserClient', () => {
  const clients: NulvlessClient[] = []

  function makeClient(options: ClientOptions = {}): NulvlessClient {
    const client = createClient(url, 'pk_test', {
      storage: new MemoryStorageAdapter(),
      storageKeys: { token: `token-${clients.length}` },
      autoRefresh: false,
      ...options,
    })

    clients.push(client)

    return client
  }

  afterEach(() => {
    for (const client of clients.splice(0)) client.auth.dispose()
  })

  describe('sign-in', () => {
    it('stores the session and emits signed-in', async () => {
      mockFetch(reply({ body: signedIn() }))
      const client = makeClient()
      const listener = jest.fn()
      client.auth.on('signed-in', listener)

      await client.auth.signIn({ email: 'a@b.co', password: 'pw' })

      expect(listener).toHaveBeenCalledWith(signedIn())
      expect(await client.auth.get()).toEqual(expect.objectContaining({ access_token: signedIn().access_token }))
    })

    it('emits challenge and stores nothing when a second factor is required', async () => {
      const challenge = { challenge: { token: 'ch', preferred: 'totp' } }
      mockFetch(reply({ body: challenge }))
      const client = makeClient()
      const signedInListener = jest.fn()
      const challengeListener = jest.fn()
      client.auth.on('signed-in', signedInListener)
      client.auth.on('challenge', challengeListener)

      await client.auth.signIn({ email: 'a@b.co', password: 'pw' })

      expect(challengeListener).toHaveBeenCalledWith(challenge)
      expect(signedInListener).not.toHaveBeenCalled()
      expect(await client.auth.get()).toBeNull()
    })

    it('emits nothing and stores nothing when the credentials are wrong', async () => {
      mockFetch(failWith(401, 'invalid_credentials'))
      const client = makeClient()
      const listener = jest.fn()
      client.auth.on('signed-in', listener)

      const result = await client.auth.signIn({ email: 'a@b.co', password: 'wrong' })

      expect(result.error?.code).toBe('invalid_credentials')
      expect(listener).not.toHaveBeenCalled()
      expect(await client.auth.get()).toBeNull()
    })

    it('still signs in when a listener throws', async () => {
      mockFetch(reply({ body: signedIn() }))
      jest.spyOn(console, 'error').mockImplementation(() => undefined)
      const client = makeClient()
      client.auth.on('signed-in', () => {
        throw new Error('listener bug')
      })

      const result = await client.auth.signIn({ email: 'a@b.co', password: 'pw' })

      expect(result.error).toBeNull()
      expect(await client.auth.get()).not.toBeNull()
    })

    it('stores the session re-issued by a sudo verification', async () => {
      mockFetch(reply({ body: signedIn('user-1', { access_token: 'sudo-token', sudo: { expires_in: 300 } }) }))
      const client = makeClient()
      await client.auth.set(signedIn())

      await client.auth.sessions.sudoVerify({ code: '123456' })

      expect((await client.auth.get())?.access_token).toBe('sudo-token')
    })
  })

  describe('authenticated calls', () => {
    it('sends the stored access token as a bearer token', async () => {
      const { lastRequest } = mockFetch()
      const client = makeClient()
      await client.auth.set(signedIn())

      await client.auth.users.me()

      expect(lastRequest().headers['Authorization']).toBe(`Bearer ${signedIn().access_token}`)
    })

    it('fails with no_session without calling the API when signed out', async () => {
      const { fetchMock } = mockFetch()

      const result = await makeClient().auth.factors.list()

      expect(result.error?.code).toBe('no_session')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('emits sudo-required when the action needs sudo', async () => {
      mockFetch(failWith(403, 'protected_action_denied'))
      const client = makeClient()
      await client.auth.set(signedIn())
      const listener = jest.fn()
      client.auth.on('sudo-required', listener)

      await client.auth.factors.unenroll({ id: 'factor-1' })

      expect(listener).toHaveBeenCalledTimes(1)
    })
  })

  describe('session renewal', () => {
    it('renews the token after a 401 and retries the call', async () => {
      const renewed = signedIn('user-1', { access_token: 'renewed', refresh_token: 'rt-2' })
      const { requests } = mockFetch(failWith(401, 'unauthorized'), reply({ body: renewed }), reply({ body: { id: 'user-1' } }))
      const client = makeClient({ multiUser: true })
      await client.auth.set(signedIn())
      const listener = jest.fn()
      client.auth.on('token-refreshed', listener)

      const result = await client.auth.users.me()

      expect(result.data).toEqual({ id: 'user-1' })
      expect(requests[1]?.url.searchParams.get('grant_type')).toBe('refresh_token')
      expect(requests[1]?.body).toEqual({ refresh_token: 'user-1-refresh' })
      expect(requests[2]?.headers['Authorization']).toBe('Bearer renewed')
      expect(listener).toHaveBeenCalledWith(renewed)
      expect((await client.auth.list())[0]?.refresh_token).toBe('rt-2')
    })

    it('drops the session and emits unauthorized when the refresh is refused', async () => {
      mockFetch(failWith(401, 'unauthorized'), failWith(401, 'refresh_token_already_used'))
      const client = makeClient()
      await client.auth.set(signedIn())
      const listener = jest.fn()
      client.auth.on('unauthorized', listener)

      const result = await client.auth.users.me()

      expect(result.error?.status_code).toBe(401)
      expect(await client.auth.get()).toBeNull()
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ user: { id: 'user-1' } }))
    })

    it('renews on demand with refreshSession', async () => {
      mockFetch(reply({ body: signedIn('user-1', { access_token: 'renewed' }) }))
      const client = makeClient()
      await client.auth.set(signedIn())

      expect(await client.auth.refreshSession()).toBe('renewed')
    })

    it('tells other tabs about a renewed token', async () => {
      const options = { storageKeys: { token: 'shared-token', accounts: 'shared-accounts' } }
      const storage = new MemoryStorageAdapter()
      const thisTab = makeClient({ ...options, storage })
      const otherTab = makeClient({ ...options, storage })
      const renewed = signedIn('user-1', { access_token: 'renewed' })
      mockFetch(reply({ body: renewed }))
      await thisTab.auth.set(signedIn())

      const received = new Promise(resolve => otherTab.auth.on('token-refreshed', resolve))
      await thisTab.auth.refreshSession()

      await expect(received).resolves.toEqual(renewed)
    })
  })

  describe('get / set', () => {
    it('reports the seconds left before the token expires', async () => {
      const client = makeClient()

      await client.auth.set(signedIn('user-1', { expires_in: 120 }))

      expect((await client.auth.get())?.expires_in).toBe(120)
    })

    it('ignores a session without an access token', async () => {
      const client = makeClient()

      await client.auth.set({ user: { id: 'user-1' } })

      expect(await client.auth.get()).toBeNull()
    })
  })

  describe('sign-out', () => {
    it('clears the session and emits signed-out with the user id', async () => {
      const { lastRequest } = mockFetch(reply({ status: 204, contentType: null }))
      const client = makeClient({ multiUser: true })
      await client.auth.set(signedIn())
      await client.auth.add(signedIn())
      const listener = jest.fn()
      client.auth.on('signed-out', listener)

      await client.auth.signOut('local')

      expect(lastRequest().url.searchParams.get('scope')).toBe('local')
      expect(await client.auth.get()).toBeNull()
      expect(await client.auth.list()).toEqual([])
      expect(listener).toHaveBeenCalledWith({ userId: 'user-1' })
    })

    it('finds the user id in the token when the session has no user', async () => {
      mockFetch(reply({ status: 204, contentType: null }))
      const client = makeClient()
      await client.auth.set({ access_token: jwt({ sub: 'user-9' }) })
      const listener = jest.fn()
      client.auth.on('signed-out', listener)

      await client.auth.signOut()

      expect(listener).toHaveBeenCalledWith({ userId: 'user-9' })
    })

    it('keeps the session when the API refuses the sign-out', async () => {
      mockFetch(failWith(500, 'internal_error'))
      const client = makeClient()
      await client.auth.set(signedIn())
      const listener = jest.fn()
      client.auth.on('signed-out', listener)

      await client.auth.signOut()

      expect(await client.auth.get()).not.toBeNull()
      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('multiple accounts', () => {
    it('remembers every account that signs in', async () => {
      mockFetch(reply({ body: signedIn('user-1') }), reply({ body: signedIn('user-2') }))
      const client = makeClient({ multiUser: true })

      await client.auth.signIn({ email: 'one@b.co', password: 'pw' })
      await client.auth.signIn({ email: 'two@b.co', password: 'pw' })

      expect((await client.auth.list()).map(account => account.userId)).toEqual(['user-1', 'user-2'])
    })

    it('switches the active session and emits account-switched', async () => {
      const client = makeClient({ multiUser: true })
      await client.auth.add(signedIn('user-1'))
      await client.auth.add(signedIn('user-2'))
      await client.auth.set(signedIn('user-2'))
      const listener = jest.fn()
      client.auth.on('account-switched', listener)

      expect(await client.auth.switch('user-1')).toBe(true)
      expect((await client.auth.get())?.user?.id).toBe('user-1')
      expect(listener).toHaveBeenCalledWith({ userId: 'user-1' })
    })

    it('does not switch to an unknown account', async () => {
      const client = makeClient({ multiUser: true })

      expect(await client.auth.switch('nobody')).toBe(false)
    })

    it('removes an account without touching the active session', async () => {
      const client = makeClient({ multiUser: true })
      await client.auth.set(signedIn('user-1'))
      await client.auth.add(signedIn('user-1'))

      await client.auth.remove('user-1')

      expect(await client.auth.list()).toEqual([])
      expect(await client.auth.get()).not.toBeNull()
    })

    it('ignores an account without an access token', async () => {
      const client = makeClient({ multiUser: true })

      await client.auth.add({ user: { id: 'user-1' } })

      expect(await client.auth.list()).toEqual([])
    })

    it('stays disabled unless multiUser is set', async () => {
      const client = makeClient()

      await client.auth.add(signedIn())
      await client.auth.remove('user-1')

      expect(await client.auth.list()).toEqual([])
      expect(await client.auth.switch('user-1')).toBe(false)
    })
  })

  describe('redirects', () => {
    afterEach(() => {
      delete (globalThis as { window?: unknown }).window
    })

    it.each([
      ['authorize', (client: NulvlessClient) => client.auth.authorize('google')],
      ['connect', (client: NulvlessClient) => client.auth.connect('github')],
    ])('%s sends the browser to the provider', async (_name, call) => {
      mockFetch(reply({ body: { url: 'https://provider.co/authorize', provider: 'google' } }))
      const client = makeClient()
      await client.auth.set(signedIn())
      const location = { href: '' }
      ;(globalThis as { window?: unknown }).window = { location }

      await call(client)

      expect(location.href).toBe('https://provider.co/authorize')
    })

    it('stays on the page when the API fails', async () => {
      mockFetch(failWith(400, 'provider_disabled'))
      const client = makeClient()
      const location = { href: '' }
      ;(globalThis as { window?: unknown }).window = { location }

      await client.auth.authorize('google')

      expect(location.href).toBe('')
    })
  })
})
