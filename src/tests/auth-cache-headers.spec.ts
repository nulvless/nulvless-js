import { applyAuthCacheHeaders, AUTH_CACHE_HEADERS } from '../helpers/auth-cache-headers'

describe('AUTH_CACHE_HEADERS', () => {
  it('carries no-store, which is what RFC 6749 §5.1 requires', () => {
    expect(AUTH_CACHE_HEADERS['Cache-Control']).toContain('no-store')
    expect(AUTH_CACHE_HEADERS.Pragma).toBe('no-cache')
    expect(AUTH_CACHE_HEADERS.Expires).toBe('0')
  })
})

describe('applyAuthCacheHeaders', () => {
  it('sets every header on a Web Response', () => {
    const response = applyAuthCacheHeaders(new Response('{}'))

    expect(response.headers.get('cache-control')).toBe(AUTH_CACHE_HEADERS['Cache-Control'])
    expect(response.headers.get('pragma')).toBe('no-cache')
    expect(response.headers.get('expires')).toBe('0')
  })

  it('sets every header on a Node ServerResponse', () => {
    const setHeader = jest.fn()
    applyAuthCacheHeaders({ setHeader })

    expect(setHeader).toHaveBeenCalledWith('Cache-Control', AUTH_CACHE_HEADERS['Cache-Control'])
    expect(setHeader).toHaveBeenCalledWith('Expires', '0')
    expect(setHeader).toHaveBeenCalledWith('Pragma', 'no-cache')
  })

  it('returns the same response so the call can be inlined into a return', () => {
    const response = new Response('{}')

    expect(applyAuthCacheHeaders(response)).toBe(response)
  })

  it('keeps the cookies the response already carries', () => {
    const response = applyAuthCacheHeaders(
      new Response('{}', { headers: { 'Set-Cookie': 'session=abc; HttpOnly' } }),
    )

    expect(response.headers.get('set-cookie')).toBe('session=abc; HttpOnly')
    expect(response.headers.get('cache-control')).toContain('no-store')
  })

  it('leaves a value that is neither response shape untouched', () => {
    const plain = { anything: true }

    expect(applyAuthCacheHeaders(plain)).toBe(plain)
  })
})
