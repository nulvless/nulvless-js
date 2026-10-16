import type { User } from '../auth/types'

export interface StoredSession {
  access_token: string
  refresh_token?: string
  /** Unix timestamp (ms) when the access token expires. */
  expires_at: number
  token_type: string
  /** Full user object from the auth response, when provided by the server. */
  user?: User
}
