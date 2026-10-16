import { AuthBrowserClient } from '../../auth'
import type { Authenticated } from '../../auth/types'
import type { HttpClient } from '../../http'
import { SessionManager } from '../manager'
import { MemoryStorageAdapter } from '../../storage/adapters/memory'

describe('deselect', () => {
  const session: Authenticated = {
    access_token: 'at-1',
    refresh_token: 'rt-1',
    expires_in: 3600,
    token_type: 'bearer',
    user: { id: 'user-1' },
  }

  let storage: MemoryStorageAdapter
  let manager: SessionManager
  let auth: AuthBrowserClient

  beforeEach(() => {
    storage = new MemoryStorageAdapter()
    manager = new SessionManager(storage, 'nulvless.session')
    auth = new AuthBrowserClient(
      { setOnSudoRequired: () => undefined } as unknown as HttpClient,
      manager,
      storage,
      'nulvless.accounts',
      true,
      false,
    )
  })

  it('should drop the active session', async () => {
    await auth.set(session)
    await auth.deselect()

    expect(await auth.get()).toBeNull()
  })

  it('should keep the account listed', async () => {
    await auth.set(session)
    await auth.add(session)
    await auth.deselect()

    expect((await auth.list()).map(entry => entry.userId)).toEqual(['user-1'])
  })

  it('should let switch bring the session back', async () => {
    await auth.set(session)
    await auth.deselect()

    expect(await auth.switch('user-1')).toBe(true)
    expect((await auth.get())?.access_token).toBe('at-1')
  })

  it('should carry the token the session was using into the accounts store', async () => {
    await auth.add(session)
    await auth.set({ ...session, refresh_token: 'rt-2' })
    await auth.deselect()

    const [entry] = await auth.list()

    expect(entry?.refresh_token).toBe('rt-2')
  })

  it('should do nothing when no session is active', async () => {
    await auth.deselect()

    expect(await auth.get()).toBeNull()
    expect(await auth.list()).toEqual([])
  })
})
