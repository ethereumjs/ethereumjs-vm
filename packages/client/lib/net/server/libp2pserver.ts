import PeerId from 'peer-id'
// eslint-disable-next-line implicit-dependencies/no-implicit
import crypto from 'libp2p-crypto'
import multiaddr from 'multiaddr'
import { Event, Libp2pConnection as Connection } from '../../types'
import { Libp2pNode } from '../peer/libp2pnode'
import { Libp2pPeer } from '../peer'
import { Server, ServerOptions } from './server'

export interface Libp2pServerOptions extends ServerOptions {
  /* Multiaddrs to listen on */
  multiaddrs?: multiaddr[]
}

/**
 * Libp2p server
 * @emits connected
 * @emits disconnected
 * @emits error
 * @memberof module:net/server
 */
export class Libp2pServer extends Server {
  private peers: Map<string, Libp2pPeer> = new Map()
  private banned: Map<string, number> = new Map()
  private multiaddrs: multiaddr[]
  private node: Libp2pNode | null

  /**
   * Create new DevP2P/RLPx server
   * @param {Libp2pServerOptions}
   */
  constructor(options: Libp2pServerOptions) {
    super(options)

    this.multiaddrs = options.multiaddrs ?? [multiaddr('/ip4/127.0.0.1/tcp/50580/ws')]

    this.node = null
    this.banned = new Map()
  }

  /**
   * Server name
   * @type {string}
   */
  get name() {
    return 'libp2p'
  }

  /**
   * Start Libp2p server. Returns a promise that resolves once server has been started.
   * @return Resolves with true if server successfully started
   */
  async start(): Promise<boolean> {
    if (this.started) {
      return false
    }
    let peerId: PeerId
    await super.start()
    if (!this.node) {
      peerId = await this.getPeerId()
      const addresses = { listen: this.multiaddrs.map((ma) => ma.toString()) }
      this.node = new Libp2pNode({
        peerId,
        addresses,
        bootnodes: this.bootnodes,
      })
      this.protocols.forEach(async (p) => {
        const protocol = `/${p.name}/${p.versions[0]}`
        this.node!.handle(protocol, async ({ connection, stream }) => {
          const [peerId] = this.getPeerInfo(connection)
          const peer = this.peers.get(peerId.toB58String())
          if (peer) {
            await peer.accept(p, stream, this)
            this.config.events.emit(Event.PEER_CONNECTED, peer)
          }
        })
      })
    }
    this.node.on('peer:discovery', async (peerId: PeerId) => {
      const id = peerId.toB58String()
      if (this.peers.get(id) || this.isBanned(id)) {
        return
      }
      const peer = this.createPeer(peerId)
      await peer.bindProtocols(this.node as Libp2pNode, peerId, this)
      this.config.logger.debug(`Peer discovered: ${peer}`)
      this.config.events.emit(Event.PEER_CONNECTED, peer)
    })
    this.node.connectionManager.on('peer:connect', (connection: Connection) => {
      const [peerId, multiaddr] = this.getPeerInfo(connection)
      const peer = this.createPeer(peerId, [multiaddr])
      this.config.logger.debug(`Peer connected: ${peer}`)
      this.config.events.emit(Event.PEER_CONNECTED, peer)
    })
    this.node.connectionManager.on('peer:disconnect', (_connection: Connection) => {
      // TODO: do anything here on disconnect?
    })
    this.node.on('error', (error: Error) => this.error(error))
    await this.node.start()
    this.node.addressManager.getListenAddrs().map(async (ma) => {
      this.config.events.emit(Event.SERVER_LISTENING, {
        transport: this.name,
        url: `${ma.toString()}/p2p/${peerId.toB58String()}`,
      })
    })
    this.started = true
    return true
  }

  /**
   * Stop Libp2p server. Returns a promise that resolves once server has been stopped.
   */
  async stop(): Promise<boolean> {
    if (this.started) {
      await this.node!.stop()
      await super.stop()
      this.started = false
    }
    return this.started
  }

  /**
   * Ban peer for a specified time
   * @param peerId id of peer
   * @param maxAge how long to ban peer (default: 60s)
   */
  ban(peerId: string, maxAge = 60000): boolean {
    if (!this.started) {
      return false
    }
    this.banned.set(peerId, Date.now() + maxAge)
    return true
  }

  /**
   * Check if peer is currently banned
   * @param  peerId id of peer
   * @return true if banned
   */
  isBanned(peerId: string): boolean {
    const expireTime = this.banned.get(peerId)
    if (expireTime && expireTime > Date.now()) {
      return true
    }
    this.banned.delete(peerId)
    return false
  }

  /**
   * Handles errors from server and peers
   * @private
   * @param  error
   * @emits  error
   */
  error(error: Error) {
    this.config.events.emit(Event.SERVER_ERROR, error, this)
  }

  async getPeerId() {
    const privKey = await crypto.keys.generateKeyPairFromSeed('ed25519', this.key, 512)
    const protoBuf = crypto.keys.marshalPrivateKey(privKey)
    return PeerId.createFromPrivKey(protoBuf)
  }

  getPeerInfo(connection: Connection): [PeerId, multiaddr] {
    return [connection.remotePeer, connection.remoteAddr]
  }

  createPeer(peerId: PeerId, multiaddrs?: multiaddr[]) {
    const peer = new Libp2pPeer({
      config: this.config,
      id: peerId.toB58String(),
      multiaddrs,
      protocols: Array.from(this.protocols),
    })
    this.peers.set(peer.id, peer)
    return peer
  }
}
