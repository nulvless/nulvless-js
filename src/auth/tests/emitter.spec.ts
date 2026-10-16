import { AuthEventEmitter } from '../emitter'

describe('AuthEventEmitter', () => {
  it('delivers the payload to every listener of the event', () => {
    const emitter = new AuthEventEmitter()
    const first = jest.fn()
    const second = jest.fn()
    const other = jest.fn()

    emitter.on('account-switched', first)
    emitter.on('account-switched', second)
    emitter.on('signed-out', other)
    emitter.emit('account-switched', { userId: 'user-1' })

    expect(first).toHaveBeenCalledWith({ userId: 'user-1' })
    expect(second).toHaveBeenCalledWith({ userId: 'user-1' })
    expect(other).not.toHaveBeenCalled()
  })

  it('emits events without a payload', () => {
    const emitter = new AuthEventEmitter()
    const listener = jest.fn()

    emitter.on('sudo-required', listener)
    emitter.emit('sudo-required')

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('stops delivering after unsubscribing', () => {
    const emitter = new AuthEventEmitter()
    const listener = jest.fn()

    const off = emitter.on('sudo-required', listener)
    off()
    emitter.emit('sudo-required')

    expect(listener).not.toHaveBeenCalled()
  })

  it('keeps notifying the other listeners when one throws', () => {
    const emitter = new AuthEventEmitter()
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const after = jest.fn()

    emitter.on('sudo-required', () => {
      throw new Error('listener bug')
    })
    emitter.on('sudo-required', after)

    expect(() => emitter.emit('sudo-required')).not.toThrow()
    expect(after).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledWith("[nulvless] 'sudo-required' listener failed", expect.any(Error))
  })

  it('removes the listeners of one event or of all events', () => {
    const emitter = new AuthEventEmitter()
    const sudo = jest.fn()
    const signedOut = jest.fn()
    emitter.on('sudo-required', sudo)
    emitter.on('signed-out', signedOut)

    emitter.removeAllListeners('sudo-required')
    emitter.emit('sudo-required')
    emitter.emit('signed-out', {})

    expect(sudo).not.toHaveBeenCalled()
    expect(signedOut).toHaveBeenCalledTimes(1)

    emitter.removeAllListeners()
    emitter.emit('signed-out', {})

    expect(signedOut).toHaveBeenCalledTimes(1)
  })
})
