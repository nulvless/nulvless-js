export interface TabMessage<T> {
  event: string
  payload: T
}

interface Channel {
  postMessage(message: unknown): void
  close(): void
  addEventListener(type: 'message', handler: (event: { data: unknown }) => void): void
}

interface ChannelConstructor {
  new (name: string): Channel
}

export class TabChannel<T> {
  private channel: Channel | null

  constructor(name: string, onMessage: (message: TabMessage<T>) => void) {
    const Ctor = (globalThis as { BroadcastChannel?: ChannelConstructor }).BroadcastChannel

    if (!Ctor) {
      this.channel = null
      return
    }

    try {
      this.channel = new Ctor(name)
    } catch {
      this.channel = null
      return
    }

    this.channel.addEventListener('message', event => {
      onMessage(event.data as TabMessage<T>)
    })

    ;(this.channel as unknown as { unref?: () => void }).unref?.()
  }

  post(message: TabMessage<T>): void {
    try {
      this.channel?.postMessage(message)
    } catch {
      this.channel = null
    }
  }

  close(): void {
    this.channel?.close()
  }
}
