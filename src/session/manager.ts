import type { NulvlessStorage } from '../storage/types'
import type { NulvlessResult } from '../types'
import type { Authenticated } from '../auth/types'
import type { StoredSession } from './types'
import { runExclusive } from './locks'
import { isSessionRefused, isTemporaryFailure } from './refreshFailure'
import { toStoredSession } from './stored'

const REFRESH_MARGIN_IN_MS = 90_000
const TICK_INTERVAL_IN_MS = 30_000

const RETRY_BACKOFF_BASE_IN_MS = 200
const MAX_RETRIES_ON_TEMPORARY_FAILURE = 3

type RefreshFn = (refresh_token: string) => Promise<NulvlessResult<Authenticated>>
type TokenRefreshedCb = (auth: Authenticated) => void
/** Receives the session that could not be recovered (null when none was stored). */
type UnauthorizedCb = (session: StoredSession | null) => void

export interface RefreshRequest {
  deauthOnFailure?: boolean
  expiredToken?: string
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function documentIsHidden(): boolean {
  return (globalThis as { document?: { hidden?: boolean } }).document?.hidden === true
}

function isBrowser(): boolean {
  const scope = globalThis as { window?: unknown; document?: unknown }

  return typeof scope.window !== 'undefined' && typeof scope.document !== 'undefined'
}

export class SessionManager {
  private refreshFn?: RefreshFn
  private onTokenRefreshed?: TokenRefreshedCb
  private onUnauthorized?: UnauthorizedCb
  private readonly sessionKey: string
  private readonly lockName: string

  private inFlight: Promise<string | null> | null = null
  private ticker: ReturnType<typeof setInterval> | undefined
  private onVisibilityChange: (() => void) | undefined

  constructor(
    private readonly storage: NulvlessStorage,
    sessionKey: string,
  ) {
    this.sessionKey = sessionKey
    this.lockName = `nulvless.session.${sessionKey}`
  }

  /**
   * Injected by `AuthClient` after construction to avoid circular dependency.
   * Called automatically when the access token is about to expire.
   */
  setRefreshFn(fn: RefreshFn): void {
    this.refreshFn = fn
  }

  /** Called after a successful automatic token refresh. */
  setOnTokenRefreshed(cb: TokenRefreshedCb): void {
    this.onTokenRefreshed = cb
  }

  /**
   * Called when the SDK cannot recover the session:
   * - no refresh token present, or
   * - the refresh request was refused by the server.
   */
  setOnUnauthorized(cb: UnauthorizedCb): void {
    this.onUnauthorized = cb
  }

  async save(auth: Authenticated): Promise<void> {
    if (!auth.access_token) return

    const session = toStoredSession({ ...auth, access_token: auth.access_token })

    await this.storage.setItem(this.sessionKey, JSON.stringify(session))
  }

  async get(): Promise<StoredSession | null> {
    const raw = await this.storage.getItem(this.sessionKey)

    if (!raw) return null

    try {
      return JSON.parse(raw) as StoredSession
    } catch {
      return null
    }
  }

  async clear(): Promise<void> {
    await this.storage.removeItem(this.sessionKey)
  }

  private expiresSoon(session: StoredSession): boolean {
    return session.expires_at - Date.now() < REFRESH_MARGIN_IN_MS
  }

  private refresh(request: RefreshRequest): Promise<string | null> {
    if (this.inFlight) {
      return this.inFlight
    }

    this.inFlight = this.runExclusiveRefresh(request).finally(() => {
      this.inFlight = null
    })

    return this.inFlight
  }

  private async runExclusiveRefresh(request: RefreshRequest): Promise<string | null> {
    const outcome = await runExclusive(this.lockName, () => this.refreshHoldingLock(request))

    return outcome.ran ? outcome.value : null
  }

  private async refreshHoldingLock(request: RefreshRequest): Promise<string | null> {
    const session = await this.get()

    if (!session) {
      if (request.deauthOnFailure) this.onUnauthorized?.(null)
      return null
    }

    const alreadyRenewed = request.expiredToken
      ? session.access_token !== request.expiredToken
      : !this.expiresSoon(session)

    if (alreadyRenewed) {
      return session.access_token
    }

    if (!session.refresh_token || !this.refreshFn) {
      if (request.deauthOnFailure) this.onUnauthorized?.(session)
      return null
    }

    return this.callRefreshFn(session, request)
  }

  private async callRefreshFn(
    session: StoredSession,
    request: RefreshRequest,
  ): Promise<string | null> {
    for (let attempt = 0; attempt <= MAX_RETRIES_ON_TEMPORARY_FAILURE; attempt += 1) {
      if (attempt > 0) {
        await sleep(RETRY_BACKOFF_BASE_IN_MS * 2 ** (attempt - 1))
      }

      const result = await this.refreshFn!(session.refresh_token!)

      if (result.data?.access_token) {
        await this.save(result.data)
        this.onTokenRefreshed?.(result.data)

        return result.data.access_token
      }

      const error = result.error

      if (error && isTemporaryFailure(error)) {
        continue
      }

      if (request.deauthOnFailure && (!error || isSessionRefused(error))) {
        await this.clear()
        this.onUnauthorized?.(session)
      }

      return null
    }

    return null
  }

  /**
   * Forces a token refresh regardless of expiry.
   * Used for reactive refresh after a 401/403 response.
   *
   * Returns the new access token, or `null` if refresh fails.
   *
   * `deauthOnFailure` (default `true`) controls side effects when the refresh
   * itself is refused: clearing the stored session and invoking `onUnauthorized`.
   * Pass `false` for soft refreshes (e.g. 403/forbidden_resource_access) where
   * the session must remain intact so the caller can surface the API error.
   */
  async forceRefresh(
    options: { deauthOnFailure?: boolean; expiredToken?: string } = {},
  ): Promise<string | null> {
    const expiredToken = options.expiredToken ?? (await this.get())?.access_token

    return this.refresh({
      deauthOnFailure: options.deauthOnFailure ?? true,
      ...(expiredToken !== undefined ? { expiredToken } : {}),
    })
  }

  /**
   * Returns a valid access token, refreshing it automatically if it is
   * expired or about to expire (within the refresh margin).
   *
   * Returns `null` when there is no session or the refresh fails.
   */
  async getValidToken(): Promise<string | null> {
    const session = await this.get()

    if (!session) return null

    if (!this.expiresSoon(session)) return session.access_token

    return this.refresh({ deauthOnFailure: true })
  }

  startAutoRefresh(): void {
    if (this.ticker || !isBrowser()) return

    this.ticker = setInterval(() => void this.tick(), TICK_INTERVAL_IN_MS)

    ;(this.ticker as unknown as { unref?: () => void }).unref?.()

    this.onVisibilityChange = () => {
      if (!documentIsHidden()) void this.tick()
    }

    ;(globalThis as unknown as Window).document.addEventListener(
      'visibilitychange',
      this.onVisibilityChange,
    )
  }

  stopAutoRefresh(): void {
    if (this.ticker) {
      clearInterval(this.ticker)
      this.ticker = undefined
    }

    if (this.onVisibilityChange && isBrowser()) {
      ;(globalThis as unknown as Window).document.removeEventListener(
        'visibilitychange',
        this.onVisibilityChange,
      )
    }

    this.onVisibilityChange = undefined
  }

  private async tick(): Promise<void> {
    if (documentIsHidden() || this.inFlight) return

    try {
      const session = await this.get()

      if (!session?.refresh_token || !this.expiresSoon(session)) return

      await runExclusive(this.lockName, () => this.refreshHoldingLock({ deauthOnFailure: true }), {
        skipWhenBusy: true,
      })
    } catch (error) {
      console.error('[nulvless] scheduled token renewal failed', error)
    }
  }
}
