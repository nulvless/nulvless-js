import { AuthClient } from '../index'
import type { HttpClient } from '../../http'
import type { SessionManager } from '../../session/manager'

function makeHttp(): jest.Mocked<Pick<HttpClient, 'get' | 'post' | 'put' | 'patch' | 'delete'>> {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  }
}

function makeSession(): jest.Mocked<
  Pick<
    SessionManager,
    | 'setRefreshFn'
    | 'setOnTokenRefreshed'
    | 'setOnUnauthorized'
    | 'get'
    | 'save'
    | 'clear'
    | 'getValidToken'
    | 'forceRefresh'
  >
> {
  return {
    setRefreshFn: jest.fn(),
    setOnTokenRefreshed: jest.fn(),
    setOnUnauthorized: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
    getValidToken: jest.fn().mockResolvedValue(null),
    forceRefresh: jest.fn().mockResolvedValue(null),
  }
}

describe('AuthClient.signIn', () => {
  let http: ReturnType<typeof makeHttp>
  let session: ReturnType<typeof makeSession>
  let auth: AuthClient

  beforeEach(() => {
    http = makeHttp()
    session = makeSession()
    auth = new AuthClient(http as unknown as HttpClient, session as unknown as SessionManager)
  })

  it('stores the session and returns tokens on success', async () => {
    const mockData = { access_token: 'access_tok', refresh_token: 'refresh_tok', expires_in: 3600 }
    http.post.mockResolvedValue({ data: mockData, error: null })

    const result = await auth.signIn({ email: 'user@example.com', password: 'secret' })

    expect(result.error).toBeNull()
    expect(result.data).toEqual(mockData)
    expect(session.save).toHaveBeenCalledWith(mockData)
    expect(http.post).toHaveBeenCalledWith(
      '/token',
      { email: 'user@example.com', password: 'secret' },
      expect.objectContaining({ query: { grant_type: 'password' } }),
    )
  })

  it('returns a challenge without storing session when MFA is required', async () => {
    const mockData = { challenge: { token: 'ch_tok', type: 'totp' } }
    http.post.mockResolvedValue({ data: mockData, error: null })

    const result = await auth.signIn({ email: 'user@example.com', password: 'secret' })

    expect(result.error).toBeNull()
    expect(result.data).toEqual(mockData)
    expect(session.save).not.toHaveBeenCalled()
  })

  it('returns an error without storing session on invalid credentials', async () => {
    const mockError = { code: 'invalid_credentials', message: 'Invalid credentials.', status_code: 401 }
    http.post.mockResolvedValue({ data: null, error: mockError })

    const result = await auth.signIn({ email: 'user@example.com', password: 'wrong' })

    expect(result.data).toBeNull()
    expect(result.error).toEqual(mockError)
    expect(session.save).not.toHaveBeenCalled()
  })
})
