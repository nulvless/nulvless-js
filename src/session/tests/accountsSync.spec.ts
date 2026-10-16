import { createClient } from '../../index'
import { MemoryStorageAdapter } from '../../storage/adapters/memory'
import type { Authenticated } from '../../auth/types'

describe('stored accounts', () => {
  const userId = 'user-1'

  function jsonResponse(body: unknown): Response {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => 'application/json' },
      json: async () => body,
    } as unknown as Response
  }

  function signedIn(accessToken: string, refreshToken: string, expiresIn: number): Authenticated {
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
      token_type: 'bearer',
      user: { id: userId },
    } as Authenticated
  }

  it('follows the rotation, so switching back does not replay a spent token', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(signedIn('access-2', 'r1.session.1.sig.guard', 3600)))

    globalThis.fetch = fetchMock as unknown as typeof fetch

    const client = createClient('https://app.nulvless.co', 'pk_test', {
      storage: new MemoryStorageAdapter(),
      multiUser: true,
      autoRefresh: false,
    })

    await client.auth.set(signedIn('access-1', 'r1.session.0.sig.guard', 10))
    await client.auth.add(signedIn('access-1', 'r1.session.0.sig.guard', 10))

    expect((await client.auth.list())[0]?.refresh_token).toBe('r1.session.0.sig.guard')

    expect(await client.auth.getAccessToken()).toBe('access-2')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [account] = await client.auth.list()

    expect(account?.refresh_token).toBe('r1.session.1.sig.guard')
    expect(account?.access_token).toBe('access-2')
  })
})
