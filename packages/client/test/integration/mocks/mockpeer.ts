import EventEmitter from 'events'
import pipe from 'it-pipe'
import pushable from 'it-pushable'
import { Peer, PeerOptions } from '../../../lib/net/peer'
import MockServer from './mockserver'
import MockSender from './mocksender'
import { RemoteStream, createStream } from './network'
import { Event } from '../../../lib/types'

// TypeScript doesn't have support yet for ReturnType
// with generic types, so this wrapper is used as a helper.
const wrapperPushable = () => pushable<Buffer>()
export type Pushable = ReturnType<typeof wrapperPushable>

interface MockPeerOptions extends PeerOptions {
  location: string
}

export default class MockPeer extends Peer {
  public location: string
  public connected: boolean

  constructor(options: MockPeerOptions) {
    super({ ...options, transport: 'mock', address: options.location })
    this.location = options.location
    this.connected = false
    this.pooled = true
  }

  async connect() {
    if (this.connected) {
      return
    }
    await this.createStream(this.location)
    this.config.events.emit(Event.PEER_CONNECTED, this)
  }

  async accept(server: MockServer) {
    if (this.connected) {
      return
    }
    await this.createStream(server.location)
    this.server = server
    this.inbound = true
  }

  async createStream(location: string) {
    const protocols = this.protocols.map((p) => `${p.name}/${p.versions[0]}`)
    const stream = createStream(this.id, location, protocols)
    await this.bindProtocols(stream)
  }

  async bindProtocols(stream: RemoteStream) {
    const receiver = new EventEmitter()
    const pushableFn: Pushable = pushable()
    pipe(pushableFn, stream)
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    pipe(stream, async (source: any) => {
      for await (const data of source) {
        setTimeout(() => {
          receiver.emit('data', data)
        }, 100)
      }
    })
    await Promise.all(
      this.protocols.map(async (p) => {
        if (!stream.protocols.includes(`${p.name}/${p.versions[0]}`)) return
        await p.open()
        await this.bindProtocol(p, new MockSender(p.name, pushableFn, receiver))
      })
    )
    this.connected = true
  }
}
