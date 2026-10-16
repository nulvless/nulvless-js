import { HttpClient, route } from '../http'
import type { HttpClientConfig } from '../http'
import { NulvlessException } from '../exceptions/nulvless.exception'
import { failWith, mockFetch, reply } from './support/fetch'

function makeHttp(config: Partial<HttpClientConfig> = {}): HttpClient {
  return new HttpClient({ baseUrl: 'https://app.nulvless.co/auth', apiKey: 'sk_test', ...config })
}

describe('HttpClient', () => {
  describe('urls', () => {
    it('joins the base url and the path with a single slash', async () => {
      const { lastRequest } = mockFetch()

      await makeHttp({ baseUrl: 'https://app.nulvless.co/auth///' }).get('//users/me')

      expect(lastRequest().url.toString()).toBe('https://app.nulvless.co/auth/users/me')
    })

    it('serialises query values and expands arrays with the bracket suffix', async () => {
      const { lastRequest } = mockFetch()

      await makeHttp().get('/admin/users', {
        query: { page: 2, is_banned: false, email: 'a@b.co', ids: ['1', '2'] },
      })

      const { searchParams } = lastRequest().url
      expect(searchParams.get('page')).toBe('2')
      expect(searchParams.get('is_banned')).toBe('false')
      expect(searchParams.get('email')).toBe('a@b.co')
      expect(searchParams.getAll('ids[]')).toEqual(['1', '2'])
    })

    it('leaves undefined query values out instead of sending the string "undefined"', async () => {
      const { lastRequest } = mockFetch()

      await makeHttp().get('/admin/users', { query: { page: 1, email: undefined } })

      expect(lastRequest().url.search).toBe('?page=1')
    })

    it('refuses dot segments, which would let a path parameter reach another endpoint', async () => {
      const { fetchMock } = mockFetch()

      const result = await makeHttp().delete(route`/admin/users/${'..'}`)

      expect(fetchMock).not.toHaveBeenCalled()
      expect(result.error).toEqual({
        code: 'invalid_path',
        message: expect.stringContaining('/admin/users/..'),
        status_code: 400,
      })
    })

    it('keeps .well-known paths, which are not dot segments', async () => {
      const { lastRequest } = mockFetch()

      await makeHttp().get('/.well-known/jwks.json')

      expect(lastRequest().url.pathname).toBe('/auth/.well-known/jwks.json')
    })
  })

  describe('headers', () => {
    it('sends the platform key, the language and the JSON content type by default', async () => {
      const { lastRequest } = mockFetch()

      await makeHttp().get('/session')

      expect(lastRequest().headers).toEqual({
        'Content-Type': 'application/json',
        'x-platform-key': 'sk_test',
        'nlv-lang': 'en-US',
      })
    })

    it('omits the platform key when the endpoint is public', async () => {
      const { lastRequest } = mockFetch()

      await makeHttp().get('/.well-known/openid-configuration', { skipApiKey: true })

      expect(lastRequest().headers).not.toHaveProperty('x-platform-key')
    })

    it('uses the per-request language over the client language', async () => {
      const { requests } = mockFetch()
      const http = makeHttp({ language: () => 'pt-BR' })

      await http.get('/a')
      await http.get('/b', { language: () => 'en-US' })

      expect(requests.map(request => request.headers['nlv-lang'])).toEqual(['pt-BR', 'en-US'])
    })

    it('signals user tracking whenever the option is set, including when it is false', async () => {
      const { requests } = mockFetch()

      await makeHttp({ trackUser: true }).get('/a')
      await makeHttp({ trackUser: false }).get('/b')
      await makeHttp().get('/c')

      expect(requests.map(request => request.headers['nlv-user-tracking'])).toEqual([
        'true',
        'false',
        undefined,
      ])
    })

    it('sends the sudo nonce only when one is given', async () => {
      const { requests } = mockFetch()
      const http = makeHttp()

      await http.delete('/factors/1', { nonce: '123456' })
      await http.delete('/factors/1', { nonce: undefined })

      expect(requests[0]?.headers['nlv-sudo-nonce']).toBe('123456')
      expect(requests[1]?.headers).not.toHaveProperty('nlv-sudo-nonce')
    })

    it('resolves client headers on every request when given a function', async () => {
      const { requests } = mockFetch()
      let requestId = 0
      const http = makeHttp({ headers: () => ({ 'x-request-id': String(++requestId) }) })

      await http.get('/a')
      await http.get('/b')

      expect(requests.map(request => request.headers['x-request-id'])).toEqual(['1', '2'])
    })

    it('lets request headers override client headers regardless of letter case', async () => {
      const { lastRequest } = mockFetch()

      await makeHttp({ headers: { 'X-App': 'client' } }).get('/a', {
        headers: { 'x-app': 'request', 'content-type': 'text/plain' },
      })

      expect(lastRequest().headers).toEqual(
        expect.objectContaining({ 'x-app': 'request', 'content-type': 'text/plain' }),
      )
      expect(lastRequest().headers).not.toHaveProperty('X-App')
      expect(lastRequest().headers).not.toHaveProperty('Content-Type')
    })
  })

  describe('hasAuthorization', () => {
    it('finds the header in the request headers whatever its case', () => {
      expect(makeHttp().hasAuthorization({ authorization: 'Bearer t' })).toBe(true)
      expect(makeHttp().hasAuthorization({ Authorization: 'Bearer t' })).toBe(true)
    })

    it('finds the header in the client-level headers', () => {
      expect(makeHttp({ headers: () => ({ authorization: 'Bearer t' }) }).hasAuthorization()).toBe(true)
    })

    it('is false when neither carries it', () => {
      expect(makeHttp({ headers: { 'x-other': '1' } }).hasAuthorization({})).toBe(false)
    })
  })

  describe('bodies', () => {
    it('sends JSON by default', async () => {
      const { lastRequest } = mockFetch()

      await makeHttp().post('/signup', { email: 'a@b.co' })

      expect(lastRequest().body).toEqual({ email: 'a@b.co' })
    })

    it('url-encodes the body when the content type asks for it', async () => {
      const { lastRequest } = mockFetch()

      await makeHttp().post('/token', { code: 'abc def' }, {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      })

      expect(lastRequest().body).toBe('code=abc+def')
    })

    it('sends no body when none is given', async () => {
      const { lastRequest } = mockFetch()

      await makeHttp().patch('/grants/1/accept')

      expect(lastRequest().body).toBeUndefined()
    })

    it.each([
      ['put', (http: HttpClient) => http.put('/x', { a: 1 })],
      ['patch', (http: HttpClient) => http.patch('/x', { a: 1 })],
      ['delete', (http: HttpClient) => http.delete('/x')],
    ])('uses the %s verb', async (verb, call) => {
      const { lastRequest } = mockFetch()

      await call(makeHttp())

      expect(lastRequest().method).toBe(verb.toUpperCase())
    })
  })

  describe('responses', () => {
    it('returns the parsed JSON body as data', async () => {
      mockFetch(reply({ body: { id: 'user-1' } }))

      await expect(makeHttp().get('/users/me')).resolves.toEqual({ data: { id: 'user-1' }, error: null })
    })

    it('accepts JSON media types with a suffix', async () => {
      mockFetch(reply({ body: { ok: true }, contentType: 'application/problem+json' }))

      await expect(makeHttp().get('/x')).resolves.toEqual({ data: { ok: true }, error: null })
    })

    it('returns null data for empty or non-JSON bodies', async () => {
      mockFetch(reply({ status: 204, contentType: null }), reply({ body: '<html>', contentType: 'text/html' }))
      const http = makeHttp()

      await expect(http.get('/a')).resolves.toEqual({ data: null, error: null })
      await expect(http.get('/b')).resolves.toEqual({ data: null, error: null })
    })

    it('returns null data when a JSON body cannot be parsed', async () => {
      mockFetch(reply({ body: '{broken' }))

      await expect(makeHttp().get('/a')).resolves.toEqual({ data: null, error: null })
    })

    it('maps an error body to a NulvlessError', async () => {
      mockFetch(reply({ status: 422, body: { code: 'validation_failed', message: ['email must be an email'] } }))

      await expect(makeHttp().post('/signup', {})).resolves.toEqual({
        data: null,
        error: { code: 'validation_failed', message: ['email must be an email'], status_code: 422 },
      })
    })

    it('falls back to the status text when the error body has no usable fields', async () => {
      mockFetch(
        new Response('oops', { status: 502, statusText: 'Bad Gateway' }),
        reply({ status: 500, body: { code: 42, message: { nested: true } } }),
      )
      const http = makeHttp()

      await expect(http.get('/a')).resolves.toEqual({
        data: null,
        error: { code: 'unknown_error', message: 'Bad Gateway', status_code: 502 },
      })
      expect((await http.get('/b')).error?.code).toBe('unknown_error')
    })

    it('reports a network failure with status 0', async () => {
      jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'))

      await expect(makeHttp().get('/a')).resolves.toEqual({
        data: null,
        error: { code: 'network_error', message: 'fetch failed', status_code: 0 },
      })
    })

    it('reports a generic message when something other than an Error is thrown', async () => {
      jest.spyOn(globalThis, 'fetch').mockRejectedValue('nope')

      expect((await makeHttp().get('/a')).error?.message).toBe('Network request failed')
    })
  })

  describe('timeout', () => {
    function hangUntilAborted() {
      return mockFetch(
        request =>
          new Promise<Response>((_resolve, reject) => {
            request.signal?.addEventListener('abort', () => {
              reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
            })
          }),
      )
    }

    it('aborts after the client timeout', async () => {
      hangUntilAborted()

      await expect(makeHttp({ timeout: 5 }).get('/slow')).resolves.toEqual({
        data: null,
        error: { code: 'request_timeout', message: 'Request timed out after 5ms', status_code: 408 },
      })
    })

    it('lets the request timeout override the client timeout', async () => {
      hangUntilAborted()

      const result = await makeHttp({ timeout: 60_000 }).get('/slow', { timeout: 5 })

      expect(result.error?.message).toBe('Request timed out after 5ms')
    })

    it('does not arm a timer when no timeout is set', async () => {
      mockFetch()
      const setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout')

      await makeHttp().get('/a')

      expect(setTimeoutSpy).not.toHaveBeenCalled()
    })
  })

  describe('throwErrors', () => {
    it('throws a NulvlessException for API errors when enabled on the client', async () => {
      mockFetch(failWith(401, 'invalid_credentials', 'Invalid credentials.'))

      const error = await makeHttp({ throwErrors: true }).post('/token', {}).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(NulvlessException)
      expect(error).toMatchObject({ code: 'invalid_credentials', status_code: 401, message: 'Invalid credentials.' })
    })

    it('throws for network errors too', async () => {
      jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'))

      await expect(makeHttp({ throwErrors: true }).get('/a')).rejects.toMatchObject({
        code: 'network_error',
        status_code: 0,
      })
    })

    it('can be switched off per request', async () => {
      mockFetch(failWith(400, 'bad_request'))

      const result = await makeHttp({ throwErrors: true }).get('/a', { throwErrors: false })

      expect(result.error?.code).toBe('bad_request')
    })

    it('can be switched on per request', async () => {
      mockFetch(failWith(400, 'bad_request'))

      await expect(makeHttp().get('/a', { throwErrors: true })).rejects.toBeInstanceOf(NulvlessException)
    })
  })

  describe('reactive token refresh', () => {
    const authorized = { headers: { Authorization: 'Bearer expired' } }

    it('refreshes once on 401 and retries with the new token', async () => {
      const { requests } = mockFetch(failWith(401, 'unauthorized'), reply({ body: { id: 'user-1' } }))
      const onTokenExpired = jest.fn().mockResolvedValue('fresh')

      const result = await makeHttp({ onTokenExpired }).get('/users/me', authorized)

      expect(result).toEqual({ data: { id: 'user-1' }, error: null })
      expect(onTokenExpired).toHaveBeenCalledWith({ deauthOnFailure: true, expiredToken: 'expired' })
      expect(requests[1]?.headers['Authorization']).toBe('Bearer fresh')
    })

    it('replaces a lowercase authorization header instead of sending two', async () => {
      const { requests } = mockFetch(failWith(401, 'unauthorized'), reply({ body: {} }))

      await makeHttp({ onTokenExpired: async () => 'fresh' }).get('/users/me', {
        headers: { authorization: 'Bearer expired' },
      })

      expect(requests[1]?.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer fresh' }))
      expect(requests[1]?.headers).not.toHaveProperty('authorization')
    })

    it.each(['forbidden_resource_access', 'forbidden_access_waiting_accept'])(
      'refreshes without deauthenticating on 403 %s',
      async code => {
        mockFetch(failWith(403, code), reply({ body: {} }))
        const onTokenExpired = jest.fn().mockResolvedValue('fresh')

        await makeHttp({ onTokenExpired }).get('/grants', authorized)

        expect(onTokenExpired).toHaveBeenCalledWith({ deauthOnFailure: false, expiredToken: 'expired' })
      },
    )

    it('does not refresh other 403 errors', async () => {
      mockFetch(failWith(403, 'protected_action_denied'))
      const onTokenExpired = jest.fn()

      await makeHttp({ onTokenExpired }).get('/factors', authorized)

      expect(onTokenExpired).not.toHaveBeenCalled()
    })

    it('does not refresh requests that were not authenticated', async () => {
      mockFetch(failWith(401, 'invalid_credentials'))
      const onTokenExpired = jest.fn()

      await makeHttp({ onTokenExpired }).post('/token', {})

      expect(onTokenExpired).not.toHaveBeenCalled()
    })

    it('returns the original error when no new token can be obtained', async () => {
      const { requests } = mockFetch(failWith(401, 'unauthorized'))

      const result = await makeHttp({ onTokenExpired: async () => null }).get('/users/me', authorized)

      expect(result.error?.code).toBe('unauthorized')
      expect(requests).toHaveLength(1)
    })

    it('retries only once even when the retry fails again', async () => {
      const { requests } = mockFetch(failWith(401, 'unauthorized'), failWith(401, 'unauthorized'))
      const onTokenExpired = jest.fn().mockResolvedValue('fresh')

      const result = await makeHttp({ onTokenExpired }).get('/users/me', authorized)

      expect(result.error?.status_code).toBe(401)
      expect(onTokenExpired).toHaveBeenCalledTimes(1)
      expect(requests).toHaveLength(2)
    })
  })

  describe('sudo', () => {
    it('notifies when an action requires sudo', async () => {
      mockFetch(failWith(403, 'protected_action_denied'))
      const http = makeHttp()
      const onSudoRequired = jest.fn()
      http.setOnSudoRequired(onSudoRequired)

      const result = await http.delete('/factors/1')

      expect(onSudoRequired).toHaveBeenCalledTimes(1)
      expect(result.error?.code).toBe('protected_action_denied')
    })

    it('stays quiet for other errors', async () => {
      mockFetch(failWith(403, 'forbidden'))
      const http = makeHttp()
      const onSudoRequired = jest.fn()
      http.setOnSudoRequired(onSudoRequired)

      await http.delete('/factors/1')

      expect(onSudoRequired).not.toHaveBeenCalled()
    })
  })

  describe('debug', () => {
    it('logs the request and the response when enabled', async () => {
      mockFetch(reply({ status: 201, body: {} }))
      const debug = jest.spyOn(console, 'debug').mockImplementation(() => undefined)

      await makeHttp({ debug: true }).post('/signup', {})

      expect(debug).toHaveBeenNthCalledWith(1, '[nulvless] → POST /signup')
      expect(debug).toHaveBeenNthCalledWith(2, expect.stringMatching(/^\[nulvless\] ← POST \/signup 201 \(\d+ms\)$/))
    })

    it('logs nothing by default', async () => {
      mockFetch()
      const debug = jest.spyOn(console, 'debug').mockImplementation(() => undefined)

      await makeHttp().get('/a')

      expect(debug).not.toHaveBeenCalled()
    })
  })
})

describe('route', () => {
  it('encodes every interpolated value as a single path segment', () => {
    expect(route`/admin/users/${'a/b?c#d'}/sessions/${42}`).toBe('/admin/users/a%2Fb%3Fc%23d/sessions/42')
  })

  it('leaves the literal parts untouched', () => {
    expect(route`/factors/codes`).toBe('/factors/codes')
  })
})

describe('NulvlessException', () => {
  it('joins validation messages into a single message', () => {
    const exception = new NulvlessException(['a is required', 'b is invalid'], 'validation_failed', 422)

    expect(exception.message).toBe('a is required, b is invalid')
    expect(exception.name).toBe('NulvlessException')
    expect(exception).toBeInstanceOf(Error)
  })
})
