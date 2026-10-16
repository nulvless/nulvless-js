export type LockOutcome<T> = { ran: true; value: T } | { ran: false }

interface LockOptions {
  skipWhenBusy?: boolean
}

interface WebLockManager {
  request(
    name: string,
    options: { mode: 'exclusive'; ifAvailable?: boolean },
    task: (lock: unknown | null) => Promise<unknown>,
  ): Promise<unknown>
}

const pendingByName = new Map<string, Promise<unknown>>()

function webLocks(): WebLockManager | null {
  const manager = (globalThis as { navigator?: { locks?: WebLockManager } }).navigator?.locks

  return typeof manager?.request === 'function' ? manager : null
}

export async function runExclusive<T>(
  name: string,
  task: () => Promise<T>,
  options: LockOptions = {},
): Promise<LockOutcome<T>> {
  const manager = webLocks()

  if (manager) {
    return (await manager.request(
      name,
      { mode: 'exclusive', ...(options.skipWhenBusy ? { ifAvailable: true } : {}) },
      async lock => (lock === null ? { ran: false } : { ran: true, value: await task() }),
    )) as LockOutcome<T>
  }

  const previous = pendingByName.get(name)

  if (previous && options.skipWhenBusy) {
    return { ran: false }
  }

  const run = (previous ?? Promise.resolve()).catch(() => undefined).then(task)
  const slot = run.catch(() => undefined)

  pendingByName.set(name, slot)

  try {
    return { ran: true, value: await run }
  } finally {
    if (pendingByName.get(name) === slot) {
      pendingByName.delete(name)
    }
  }
}
