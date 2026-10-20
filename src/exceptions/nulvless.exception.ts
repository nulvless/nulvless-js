import type { ErrorCode } from '../error-codes'

/**
 * Thrown when `throwErrors: true` is set and the API returns an error response.
 *
 * Mirrors the same `{ code, message, status_code }` shape returned by default —
 * the only difference is delivery: exception vs. discriminated union.
 *
 * @example
 * import { NulvlessException } from '@nulvless/nulvless-js'
 *
 * try {
 *   const { data } = await nulvless.auth.signIn({ email, password })
 * } catch (err) {
 *   if (err instanceof NulvlessException) {
 *     console.error(err.code, err.status_code, err.message)
 *   }
 * }
 */
export class NulvlessException extends Error {
  readonly code: ErrorCode
  readonly status_code: number

  constructor(message: string | string[], code: ErrorCode, status_code: number) {
    super(Array.isArray(message) ? message.join(', ') : message)
    this.name = 'NulvlessException'
    this.code = code
    this.status_code = status_code
  }
}
