import type { NulvlessError } from '../types'

const REFUSAL_CODES = new Set([
  'unauthorized',
  'refresh_token_not_found',
  'refresh_token_already_used',
  'refresh_token_not_issued_here',
  'user_banned',
])

export function isTemporaryFailure(error: NulvlessError): boolean {
  return (
    error.status_code === 0 ||
    error.status_code === 408 ||
    error.status_code === 429 ||
    error.status_code >= 500
  )
}

export function isSessionRefused(error: NulvlessError): boolean {
  return REFUSAL_CODES.has(error.code) || error.status_code === 401
}
