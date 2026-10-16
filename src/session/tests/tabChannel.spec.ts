import { TabChannel } from '../tabChannel'
import type { TabMessage } from '../tabChannel'

describe('TabChannel', () => {
  const scope = globalThis as { BroadcastChannel?: unknown }
  const RealBroadcastChannel = scope.BroadcastChannel

  afterEach(() => {
    scope.BroadcastChannel = RealBroadcastChannel
  })

  it('delivers a message to the other channels with the same name', async () => {
    const received = new Promise<TabMessage<string>>(resolve => {
      const listener = new TabChannel<string>('tabs-test', resolve)
      setTimeout(() => listener.close(), 1000).unref()
    })
    const sender = new TabChannel<string>('tabs-test', () => undefined)

    sender.post({ event: 'token-refreshed', payload: 'hello' })

    await expect(received).resolves.toEqual({ event: 'token-refreshed', payload: 'hello' })
    sender.close()
  })

  it('does nothing where BroadcastChannel does not exist', () => {
    delete scope.BroadcastChannel

    const channel = new TabChannel('tabs-none', () => undefined)

    expect(() => channel.post({ event: 'e', payload: null })).not.toThrow()
    expect(() => channel.close()).not.toThrow()
  })

  it('does nothing when the channel cannot be opened', () => {
    scope.BroadcastChannel = class {
      constructor() {
        throw new Error('blocked')
      }
    }

    const channel = new TabChannel('tabs-blocked', () => undefined)

    expect(() => channel.post({ event: 'e', payload: null })).not.toThrow()
  })

  it('stops posting after the channel fails once', () => {
    const postMessage = jest.fn(() => {
      throw new Error('closed')
    })
    scope.BroadcastChannel = class {
      postMessage = postMessage
      addEventListener() {}
      close() {}
    }

    const channel = new TabChannel('tabs-failing', () => undefined)
    channel.post({ event: 'e', payload: 1 })
    channel.post({ event: 'e', payload: 2 })

    expect(postMessage).toHaveBeenCalledTimes(1)
  })
})
