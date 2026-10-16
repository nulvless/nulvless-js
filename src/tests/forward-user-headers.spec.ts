import { forwardUserHeaders } from '../helpers/forward-user-headers'

describe('forwardUserHeaders', () => {
  const browserHeaders = {
    authorization: 'Bearer user-token',
    'user-agent': 'Mozilla/5.0',
    'accept-language': 'pt-BR',
    'x-forwarded-for': '203.0.113.7',
    cookie: 'session=secret',
    'x-internal': 'do-not-forward',
  }

  it('picks the tracking headers from a Web Request', () => {
    const request = new Request('https://app.co/login', { headers: browserHeaders })

    expect(forwardUserHeaders(request)).toEqual({
      authorization: 'Bearer user-token',
      'user-agent': 'Mozilla/5.0',
      'accept-language': 'pt-BR',
      'x-forwarded-for': '203.0.113.7',
    })
  })

  it('picks the tracking headers from a Node request', () => {
    expect(forwardUserHeaders({ headers: browserHeaders })).toEqual({
      authorization: 'Bearer user-token',
      'user-agent': 'Mozilla/5.0',
      'accept-language': 'pt-BR',
      'x-forwarded-for': '203.0.113.7',
    })
  })

  it('takes the first value of a repeated Node header', () => {
    expect(forwardUserHeaders({ headers: { 'x-forwarded-for': ['203.0.113.7', '10.0.0.1'] } })).toEqual({
      'x-forwarded-for': '203.0.113.7',
    })
  })

  it('skips headers that are missing or empty', () => {
    expect(forwardUserHeaders({ headers: { host: undefined, origin: '' } })).toEqual({})
  })
})
