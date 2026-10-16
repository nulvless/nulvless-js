import type { Authenticated } from '../auth/types'
import type { StoredSession } from './types'

const DEFAULT_EXPIRES_IN_SECONDS = 3600

export function toStoredSession(auth: Authenticated & { access_token: string }): StoredSession {
  return {
    access_token: auth.access_token,
    ...(auth.refresh_token !== undefined ? { refresh_token: auth.refresh_token } : {}),
    expires_at: Date.now() + (auth.expires_in ?? DEFAULT_EXPIRES_IN_SECONDS) * 1000,
    token_type: auth.token_type ?? 'bearer',
    ...(auth.user !== undefined ? { user: auth.user } : {}),
  }
}

export function toAuthenticated(stored: StoredSession): Authenticated {
  return {
    access_token: stored.access_token,
    ...(stored.refresh_token !== undefined ? { refresh_token: stored.refresh_token } : {}),
    ...(stored.token_type ? { token_type: stored.token_type as NonNullable<Authenticated['token_type']> } : {}),
    expires_in: Math.round((stored.expires_at - Date.now()) / 1000),
    ...(stored.user !== undefined ? { user: stored.user } : {}),
  }
}
