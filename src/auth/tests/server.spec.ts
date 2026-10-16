import { createServerClient } from '../../index'
import { forwardUserHeaders } from '../../helpers/forward-user-headers'
import { mockFetch, reply } from '../../tests/support/fetch'

const url = 'https://app.nulvless.co'

describe('AuthServerClient', () => {
  it('fails with no_session before calling the API when no Authorization is available', async () => {
    const { fetchMock } = mockFetch()
    const client = createServerClient(url, 'sk_test')

    const results = await Promise.all([
      client.auth.verify(),
      client.auth.getSession(),
      client.auth.getMethods(),
      client.auth.signOut(),
      client.auth.connect('github'),
      client.auth.users.me(),
      client.auth.grants.list(),
      client.auth.oauth.userinfo(),
    ])

    expect(fetchMock).not.toHaveBeenCalled()
    for (const result of results) {
      expect(result).toEqual({
        data: null,
        error: { code: 'no_session', message: 'No active session.', status_code: 401 },
      })
    }
  })

  it('forwards the Authorization header of the user request as is', async () => {
    const { lastRequest } = mockFetch()

    await createServerClient(url, 'sk_test').auth.users.me({ headers: { Authorization: 'Bearer user-token' } })

    expect(lastRequest().headers['Authorization']).toBe('Bearer user-token')
  })

  it('accepts the lowercase header that forwardUserHeaders produces', async () => {
    const { requests } = mockFetch()
    const client = createServerClient(url, 'sk_test')
    const headers = forwardUserHeaders(new Request(`${url}/me`, { headers: { authorization: 'Bearer user-token' } }))

    await client.auth.verify(undefined, { headers })
    await client.auth.factors.list({ headers })

    for (const request of requests) {
      expect(request.headers['authorization']).toBe('Bearer user-token')
      expect(request.headers).not.toHaveProperty('Authorization')
    }
  })

  it('takes the Authorization header from client-level headers resolved per request', async () => {
    const { lastRequest } = mockFetch()
    const client = createServerClient(url, 'sk_test', {
      headers: () => ({ authorization: 'Bearer from-request-context' }),
    })

    const result = await client.auth.sessions.list()

    expect(result.error).toBeNull()
    expect(lastRequest().headers['authorization']).toBe('Bearer from-request-context')
  })

  it('returns the authorization URL without redirecting outside a browser', async () => {
    mockFetch(reply({ body: { url: 'https://accounts.google.com/o/oauth2', provider: 'google' } }))

    const result = await createServerClient(url, 'sk_test').auth.authorize('google')

    expect(result.data).toEqual({ url: 'https://accounts.google.com/o/oauth2', provider: 'google' })
  })

  it('exposes the server-only namespaces', () => {
    const client = createServerClient(url, 'sk_test')

    expect(client.auth.grants).toBeDefined()
    expect(client.auth.admin.users).toBeDefined()
    expect(client.auth.admin.roles).toBeDefined()
    expect(client.auth.admin.grants).toBeDefined()
    expect(client.auth.admin.oauthClients).toBeDefined()
  })

  it('has no stored session to hand out', async () => {
    await expect(createServerClient(url, 'sk_test').auth.getAccessToken()).resolves.toBeNull()
  })
})

describe('auth.oauth.authorize', () => {
  const discovery = { authorization_endpoint: 'https://app.nulvless.co/auth/oauth/authorize' }
  const params = {
    client_id: 'app',
    redirect_uri: 'https://rp.co/cb',
    code_challenge: 'challenge',
    code_challenge_method: 'S256' as const,
    state: 'xyz',
  }

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window
  })

  it('builds the authorization URL from the discovery document', async () => {
    mockFetch(reply({ body: discovery }))

    const result = await createServerClient(url, 'sk_test').auth.oauth.authorize(params)
    const authorizeUrl = new URL(result.data!.url)

    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(discovery.authorization_endpoint)
    expect(Object.fromEntries(authorizeUrl.searchParams)).toEqual({
      client_id: 'app',
      redirect_uri: 'https://rp.co/cb',
      response_type: 'code',
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
      state: 'xyz',
    })
  })

  it('redirects the browser to the authorization URL', async () => {
    mockFetch(reply({ body: discovery }))
    const location = { href: '' }
    ;(globalThis as { window?: unknown }).window = { location }

    const result = await createServerClient(url, 'sk_test').auth.oauth.authorize(params)

    expect(location.href).toBe(result.data?.url)
  })

  it('returns the discovery error when the document cannot be loaded', async () => {
    mockFetch(reply({ status: 503, body: { code: 'unavailable', message: 'down' } }))

    const result = await createServerClient(url, 'sk_test').auth.oauth.authorize(params)

    expect(result.error).toEqual({ code: 'unavailable', message: 'down', status_code: 503 })
  })
})
