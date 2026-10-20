import type { NulvlessStorage } from '../storage/types'
import type { StoredSession } from '../session/types'
import type { Authenticated, User } from './types'
import { toStoredSession } from '../session/stored'

export interface AccountEntry {
  userId: string
  access_token: string
  expires_in: number
  refresh_token?: string
  user?: User
}

type AccountsMap = Record<string, StoredSession>

function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const bytes = Uint8Array.from(atob(padded), char => char.charCodeAt(0))

  return new TextDecoder().decode(bytes)
}

export function extractUserId(auth: Authenticated): string | null {
  if (auth.user?.id) return auth.user.id
  if (!auth.access_token) return null
  try {
    const payload = JSON.parse(decodeBase64Url(auth.access_token.split('.')[1]!)) as Record<string, unknown>
    return typeof payload['sub'] === 'string' ? payload['sub'] : null
  } catch {
    return null
  }
}

export class AccountsManager {
  constructor(
    private readonly storage: NulvlessStorage,
    private readonly accountsKey: string,
  ) {}

  private async readMap(): Promise<AccountsMap> {
    const raw = await this.storage.getItem(this.accountsKey)
    if (!raw) return {}
    try {
      return JSON.parse(raw) as AccountsMap
    } catch {
      return {}
    }
  }

  private async writeMap(map: AccountsMap): Promise<void> {
    await this.storage.setItem(this.accountsKey, JSON.stringify(map))
  }

  async save(auth: Authenticated): Promise<string | null> {
    const userId = extractUserId(auth)
    if (!userId || !auth.access_token) return null

    const map = await this.readMap()
    map[userId] = toStoredSession({ ...auth, access_token: auth.access_token })
    await this.writeMap(map)
    return userId
  }

  async getSession(userId: string): Promise<StoredSession | null> {
    const map = await this.readMap()
    return map[userId] ?? null
  }

  async list(): Promise<AccountEntry[]> {
    const map = await this.readMap()
    return Object.entries(map).map(([userId, session]) => ({
      userId,
      access_token: session.access_token,
      expires_in: Math.round((session.expires_at - Date.now()) / 1000),
      ...(session.refresh_token !== undefined ? { refresh_token: session.refresh_token } : {}),
      ...(session.user !== undefined ? { user: session.user } : {}),
    }))
  }

  async remove(userId: string): Promise<void> {
    const map = await this.readMap()
    delete map[userId]
    await this.writeMap(map)
  }
}
