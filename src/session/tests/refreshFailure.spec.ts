import { isSessionRefused, isTemporaryFailure } from '../refreshFailure'
import type { NulvlessError } from '../../types'

function error(status_code: number, code: string): NulvlessError {
  return { code, message: code, status_code }
}

describe('refresh failure classification', () => {
  it.each([
    ['no network', error(0, 'network_error')],
    ['a timeout', error(408, 'request_timeout')],
    ['a throttled request', error(429, 'too_many_requests')],
    ['a failing server', error(503, 'unavailable')],
  ])('treats %s as temporary', (_label, failure) => {
    expect(isTemporaryFailure(failure)).toBe(true)
    expect(isSessionRefused(failure)).toBe(false)
  })

  it.each([
    ['an expired session', error(401, 'unauthorized')],
    ['a replayed token', error(400, 'refresh_token_already_used')],
    ['an unknown token', error(400, 'refresh_token_not_found')],
    ['a token from elsewhere', error(400, 'refresh_token_not_issued_here')],
    ['a banned user', error(403, 'user_banned')],
  ])('treats %s as a refusal', (_label, failure) => {
    expect(isSessionRefused(failure)).toBe(true)
    expect(isTemporaryFailure(failure)).toBe(false)
  })

  it('leaves an unrelated client error in neither bucket', () => {
    const failure = error(422, 'validation_failed')

    expect(isTemporaryFailure(failure)).toBe(false)
    expect(isSessionRefused(failure)).toBe(false)
  })
})
