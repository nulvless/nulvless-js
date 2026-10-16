import type { Authenticated } from './types'

export interface AuthEvents {
  /** Emitted when a sign-in or sign-up succeeds and an access token is stored. */
  'signed-in': Authenticated
  /** Emitted after `signOut` succeeds. */
  'signed-out': { userId?: string }
  /** Emitted when the server returns a challenge (MFA/OTP) with no access token. */
  'challenge': Authenticated
  /** Emitted after the access token is refreshed automatically. */
  'token-refreshed': Authenticated
  /** Emitted when `switch()` succeeds. */
  'account-switched': { userId: string }
  /**
   * Emitted when the SDK cannot authenticate the user:
   * - there is no refresh token, or
   * - a refresh attempt was rejected by the server (401 / `unauthorized`).
   *
   * The payload carries the failed session (its `user` when known), so
   * multi-user callers can remove the right entry from the accounts store.
   */
  'unauthorized': Authenticated
  /**
   * Emitted when any request fails with `403 protected_action_denied`,
   * meaning the action requires an active sudo session.
   * Run the sudo flow (`auth.sessions.sudo()` → `auth.challenges.verify()`)
   * to activate sudo mode, then retry.
   */
  'sudo-required': void
}

type Listener<T> = T extends void ? () => void : (payload: T) => void
type UnsubscribeFn = () => void

export class AuthEventEmitter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly listeners = new Map<keyof AuthEvents, Set<Listener<any>>>()

  on<K extends keyof AuthEvents>(event: K, handler: Listener<AuthEvents[K]>): UnsubscribeFn {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(handler)
    return () => { set!.delete(handler) }
  }

  emit<K extends keyof AuthEvents>(
    ...args: AuthEvents[K] extends void ? [event: K] : [event: K, payload: AuthEvents[K]]
  ): void {
    const [event, payload] = args
    const set = this.listeners.get(event)
    if (!set) return
    for (const handler of set) {
      try {
        ;(handler as (p: unknown) => void)(payload)
      } catch (error) {
        console.error(`[nulvless] '${event}' listener failed`, error)
      }
    }
  }

  removeAllListeners(event?: keyof AuthEvents): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }
}
