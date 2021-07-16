import { Server, ServerOptions } from '../../../lib/net/server'
import { Event } from '../../../lib/types'
import MockPeer from './mockpeer'
import { RemoteStream, createServer, destroyServer } from './network'

interface MockServerOptions extends ServerOptions {
  location?: string
}

export default class MockServer extends Server {
  public location: string
  public server: Server | null
  public peers: { [key: string]: MockPeer }

  constructor(options: MockServerOptions) {
    super(options)
    this.location = options.location ?? '127.0.0.1'
    this.server = null
    this.peers = {}
  }

  get name() {
    return 'mock'
  }

  async start(): Promise<boolean> {
    if (this.started) {
      return false
    }
    await super.start()
    await this.wait(1)

    this.server = createServer(this.location) as any
    this.config.events.emit(Event.SERVER_LISTENING, {
      transport: this.name,
      url: `mock://${this.location}`,
    })

    this.server!.on('connection', async ({ id, stream }) => {
      await this.connect(id, stream)
    })
    return true
  }

  async stop(): Promise<boolean> {
    await new Promise((resolve) => {
      setTimeout(() => {
        destroyServer(this.location)
        resolve(undefined)
      }, 20)
    })
    await super.stop()
    return this.started
  }

  async discover(id: string, location: string) {
    const opts = { config: this.config, address: 'mock', transport: 'mock' }
    const peer = new MockPeer({ id, location, protocols: Array.from(this.protocols), ...opts })
    await peer.connect()
    this.peers[id] = peer
    this.config.events.emit(Event.POOL_PEER_ADDED, peer)
    return peer
  }

  async accept(id: string) {
    const opts = { config: this.config, address: 'mock', transport: 'mock', location: 'mock' }
    const peer = new MockPeer({ id, protocols: Array.from(this.protocols), ...opts })
    await peer.accept(this)
    return peer
  }

  async connect(id: string, stream: RemoteStream) {
    const opts = { config: this.config, address: 'mock', transport: 'mock', location: 'mock' }
    const peer = new MockPeer({
      id,
      inbound: true,
      server: this,
      protocols: Array.from(this.protocols),
      ...opts,
    })
    await peer.bindProtocols(stream)
    this.peers[id] = peer
    this.config.events.emit(Event.PEER_CONNECTED, peer)
  }

  disconnect(id: string) {
    const peer = this.peers[id]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (peer) this.config.events.emit(Event.PEER_DISCONNECTED, peer)
  }

  async wait(delay?: number) {
    await new Promise((resolve) => setTimeout(resolve, delay ?? 100))
  }
}
