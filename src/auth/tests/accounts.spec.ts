import { AccountsManager, extractUserId } from '../accounts'
import { MemoryStorageAdapter } from '../../storage/adapters/memory'
import { jwt } from '../../tests/support/tokens'

describe('extractUserId', () => {
  it('prefers the user id from the response', () => {
    expect(extractUserId({ access_token: jwt({ sub: 'from-token' }), user: { id: 'from-user' } })).toBe('from-user')
  })

  it('reads the sub claim of the access token', () => {
    expect(extractUserId({ access_token: jwt({ sub: 'user-1' }) })).toBe('user-1')
  })

  it('decodes base64url payloads that plain base64 would reject', () => {
    const sub = 'ü>>>?~~~'

    expect(jwt({ sub }).split('.')[1]).toMatch(/[-_]/)
    expect(extractUserId({ access_token: jwt({ sub }) })).toBe(sub)
  })

  it.each([
    ['there is no access token', {}],
    ['the token is not a JWT', { access_token: 'opaque' }],
    ['the payload is not JSON', { access_token: 'a.bm90LWpzb24.c' }],
    ['the sub claim is not a string', { access_token: jwt({ sub: 42 }) }],
  ])('returns null when %s', (_label, auth) => {
    expect(extractUserId(auth)).toBeNull()
  })
})

describe('AccountsManager', () => {
  const key = 'accounts'
  let storage: MemoryStorageAdapter
  let accounts: AccountsManager

  beforeEach(() => {
    storage = new MemoryStorageAdapter()
    accounts = new AccountsManager(storage, key)
  })

  it('saves an account under its user id', async () => {
    const userId = await accounts.save({ access_token: 'at', refresh_token: 'rt', expires_in: 60, user: { id: 'user-1' } })

    expect(userId).toBe('user-1')
    expect(await accounts.list()).toEqual([
      { userId: 'user-1', access_token: 'at', refresh_token: 'rt', expires_in: 60, user: { id: 'user-1' } },
    ])
  })

  it('does not save an account it cannot identify', async () => {
    expect(await accounts.save({ access_token: 'opaque' })).toBeNull()
    expect(await accounts.save({ user: { id: 'user-1' } })).toBeNull()
    expect(await accounts.list()).toEqual([])
  })

  it('replaces the entry of a user that signs in again', async () => {
    await accounts.save({ access_token: 'old', user: { id: 'user-1' } })
    await accounts.save({ access_token: 'new', user: { id: 'user-1' } })

    expect((await accounts.list()).map(entry => entry.access_token)).toEqual(['new'])
  })

  it('returns the stored session of a user', async () => {
    await accounts.save({ access_token: jwt({ sub: 'user-1' }) })

    expect(await accounts.getSession('user-1')).toEqual(expect.objectContaining({ token_type: 'bearer' }))
    expect(await accounts.getSession('user-2')).toBeNull()
  })

  it('removes one account and keeps the others', async () => {
    await accounts.save({ access_token: 'a', user: { id: 'user-1' } })
    await accounts.save({ access_token: 'b', user: { id: 'user-2' } })

    await accounts.remove('user-1')

    expect((await accounts.list()).map(entry => entry.userId)).toEqual(['user-2'])
  })

  it('starts over when the stored map is corrupt', async () => {
    await storage.setItem(key, '{not json')

    expect(await accounts.list()).toEqual([])
  })
})
