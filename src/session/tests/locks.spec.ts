import { runExclusive } from '../locks'

const implementations: Array<[label: string, webLocks: boolean]> = [['with the in-process fallback', false]]

if (typeof globalThis.navigator?.locks?.request === 'function') {
  implementations.unshift(['with Web Locks', true])
}

describe.each(implementations)('runExclusive %s', (_label, webLocks) => {
  beforeEach(() => {
    if (!webLocks && 'navigator' in globalThis) jest.replaceProperty(globalThis, 'navigator', {} as Navigator)
  })

  function deferred(): { promise: Promise<void>; resolve: () => void } {
    let resolve!: () => void
    const promise = new Promise<void>(r => {
      resolve = r
    })

    return { promise, resolve }
  }

  it('returns what the task returned', async () => {
    await expect(runExclusive('a', async () => 'done')).resolves.toEqual({
      ran: true,
      value: 'done',
    })
  })

  it('runs tasks of the same name one after the other', async () => {
    const gate = deferred()
    const order: string[] = []

    const first = runExclusive('same', async () => {
      order.push('first-in')
      await gate.promise
      order.push('first-out')
    })

    const second = runExclusive('same', async () => {
      order.push('second')
    })

    gate.resolve()
    await Promise.all([first, second])

    expect(order).toEqual(['first-in', 'first-out', 'second'])
  })

  it('lets different names run at the same time', async () => {
    const gate = deferred()
    const order: string[] = []

    const blocked = runExclusive('one', async () => {
      await gate.promise
      order.push('one')
    })

    await runExclusive('two', async () => {
      order.push('two')
    })

    gate.resolve()
    await blocked

    expect(order).toEqual(['two', 'one'])
  })

  it('skips instead of queueing when asked and the name is busy', async () => {
    const gate = deferred()
    const task = jest.fn()

    const holder = runExclusive('busy', () => gate.promise)
    const skipped = await runExclusive('busy', async () => task(), { skipWhenBusy: true })

    gate.resolve()
    await holder

    expect(skipped).toEqual({ ran: false })
    expect(task).not.toHaveBeenCalled()
  })

  it('frees the name again after the queue drains', async () => {
    await runExclusive('drain', async () => undefined)

    await expect(runExclusive('drain', async () => 'free', { skipWhenBusy: true })).resolves.toEqual(
      { ran: true, value: 'free' },
    )
  })

  it('keeps the queue moving when a task throws', async () => {
    await expect(
      runExclusive('failing', async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')

    await expect(runExclusive('failing', async () => 'after')).resolves.toEqual({
      ran: true,
      value: 'after',
    })
  })
})
