import * as events from 'events'
import {
  Protocol,
  BoundProtocol,
  EthProtocolMethods,
  LesProtocolMethods,
  Sender,
} from '../protocol'
import { Server } from '../server'
import { Config } from '../../config'

export interface PeerOptions {
  /* Config */
  config: Config

  /* Peer id */
  id?: string

  /* Peer address */
  address: string

  /* Transport name */
  transport: string

  /* Pass true if peer initiated connection (default: false) */
  inbound?: boolean

  /* Supported protocols */
  protocols?: Protocol[]

  /* Server */
  server?: Server
}

/**
 * Network peer
 * @memberof module:net/peer
 */
export class Peer extends events.EventEmitter {
  public config: Config
  public id: string
  public address: string
  public inbound: boolean
  public server: Server | undefined
  public bound: Map<string, BoundProtocol>
  protected transport: string
  protected protocols: Protocol[]
  private _idle: boolean

  /*
    If the peer is in the PeerPool.
    If true, messages are handled immediately.
    If false, adds incoming messages to handleMessageQueue,
    which are handled after the peer is added to the pool.
  */
  public pooled: boolean = false

  // Dynamically bound protocol properties
  public eth: (BoundProtocol & EthProtocolMethods) | undefined
  public les: (BoundProtocol & LesProtocolMethods) | undefined

  /**
   * Create new peer
   * @param {PeerOptions}
   */
  constructor(options: PeerOptions) {
    super()

    this.config = options.config

    this.id = options.id ?? ''
    this.address = options.address
    this.transport = options.transport
    this.inbound = options.inbound ?? false
    this.protocols = options.protocols ?? []
    this.bound = new Map()

    this._idle = true
  }

  /**
   * Get idle state of peer
   * @type {boolean}
   */
  get idle() {
    return this._idle
  }

  /**
   * Set idle state of peer
   * @type {boolean}
   */
  set idle(value) {
    this._idle = value
  }

  /**
   * Adds a protocol to this peer given a sender instance. Protocol methods
   * will be accessible via a field with the same name as protocol. New methods
   * will be added corresponding to each message defined by the protocol, in
   * addition to send() and request() methods that takes a message name and message
   * arguments. send() only sends a message without waiting for a response, whereas
   * request() also sends the message but will return a promise that resolves with
   * the response payload.
   * @protected
   * @param  {Protocol}  protocol protocol instance
   * @param  {Sender}    sender Sender instance provided by subclass
   * @return {Promise}
   * @example
   * await peer.bindProtocol(ethProtocol, sender)
   * // Example: Directly call message name as a method on the bound protocol
   * const headers1 = await peer.eth.getBlockHeaders({ block: new BN(1), max: 100 })
   * // Example: Call request() method with message name as first parameter
   * const headers2 = await peer.eth.request('getBlockHeaders', { block: new BN(1), max: 100 })
   * // Example: Call send() method with message name as first parameter and
   * // wait for response message as an event
   * peer.eth.send('getBlockHeaders', { block: new BN(1), max: 100 })
   * peer.eth.on('message', ({ data }) => console.log(`Received ${data.length} headers`))
   */
  async bindProtocol(protocol: Protocol, sender: Sender): Promise<void> {
    const bound = await protocol.bind(this, sender)
    this.bound.set(bound.name, bound)
  }

  /**
   * Return true if peer understand the specified protocol name
   * @param protocolName
   */
  understands(protocolName: string): boolean {
    return !!this.bound.get(protocolName)
  }

  /**
   * Handle unhandled messages along handshake
   */
  handleMessageQueue() {
    this.bound.forEach(async (bound) => {
      bound.handleMessageQueue()
    })
  }

  toString(withFullId = false): string {
    const properties = {
      id: withFullId ? this.id : this.id.substr(0, 8),
      address: this.address,
      transport: this.transport,
      protocols: Array.from(this.bound.keys()),
      inbound: this.inbound,
    }
    /* eslint-disable @typescript-eslint/no-unnecessary-condition */
    return Object.entries(properties)
      .filter(([, value]) => value !== undefined && value !== null && value.toString() !== '')
      .map((keyValue) => keyValue.join('='))
      .join(' ')
  }
}
