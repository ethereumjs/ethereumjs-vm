import multiaddr from 'multiaddr'
import PeerId from 'peer-id'
import { Libp2pMuxedStream as MuxedStream } from '../../types'
import { Libp2pSender } from '../protocol/libp2psender'
import { Peer, PeerOptions } from './peer'
import { Libp2pNode } from './libp2pnode'
import { Protocol } from '../protocol'
import { Libp2pServer } from '../server'
import { Event } from '../../types'
export interface Libp2pPeerOptions extends Omit<PeerOptions, 'address' | 'transport'> {
  /* Multiaddrs to listen on */
  multiaddrs?: multiaddr[]
}

/**
 * Libp2p peer
 * @memberof module:net/peer
 * @example
 *
 * import multiaddr from 'multiaddr'
 * import { Libp2pPeer } from './lib/net/peer'
 * import { Chain } from './lib/blockchain'
 * import { EthProtocol } from './lib/net/protocol'
 *
 * const chain = new Chain()
 * const protocols = [new EthProtocol({ chain })]
 * const id = 'QmWYhkpLFDhQBwHCMSWzEebbJ5JzXWBKLJxjEuiL8wGzUu'
 * const multiaddrs = [multiaddr('/ip4/192.0.2.1/tcp/12345')]
 *
 * new Libp2pPeer({ id, multiaddrs, protocols })
 *   .on('error', (err) => console.log('Error: ', err))
 *   .on('connected', () => console.log('Connected'))
 *   .on('disconnected', (reason) => console.log('Disconnected: ', reason))
 *   .connect()
 */
export class Libp2pPeer extends Peer {
  private multiaddrs: multiaddr[]
  private connected: boolean

  /**
   * Create new libp2p peer
   * @param {Libp2pPeerOptions}
   */
  constructor(options: Libp2pPeerOptions) {
    const multiaddrs = options.multiaddrs ?? [multiaddr('/ip4/0.0.0.0/tcp/0')]
    const address = multiaddrs.map((ma) => ma.toString().split('/p2p')[0]).join(',')

    super({ ...options, transport: 'libp2p', address })

    this.multiaddrs = multiaddrs
    this.connected = false
  }

  /**
   * Initiate peer connection
   * @return {Promise}
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return
    }
    const peerId = PeerId.createFromB58String(this.id)
    const addresses = { listen: ['/ip4/0.0.0.0/tcp/0'] }
    const node = new Libp2pNode({ peerId, addresses })
    await node.start()
    for (const ma of this.multiaddrs) {
      await node.dial(ma)
      await this.bindProtocols(node, ma)
    }
    this.config.events.emit(Event.PEER_CONNECTED, this)
  }

  /**
   * Accept new peer connection from a libp2p server
   * @private
   * @return {Promise}
   */
  async accept(protocol: Protocol, stream: MuxedStream, server: Libp2pServer): Promise<void> {
    await this.bindProtocol(protocol, new Libp2pSender(stream))
    this.inbound = true
    this.server = server
  }

  /**
   * Adds protocols to the peer given a libp2p node and peerId or multiaddr
   * @private
   * @param node libp2p node
   * @param peer libp2p peerId or mutliaddr
   * @param server server that initiated connection
   */
  async bindProtocols(
    node: Libp2pNode,
    peer: PeerId | multiaddr,
    server?: Libp2pServer
  ): Promise<void> {
    await Promise.all(
      this.protocols.map(async (p) => {
        await p.open()
        const protocol = `/${p.name}/${p.versions[0]}`
        try {
          const { stream } = await node.dialProtocol(peer, protocol)
          await this.bindProtocol(p, new Libp2pSender(stream))
        } catch (err) {
          const peerInfo =
            peer instanceof PeerId ? `id=${peer.toB58String()}` : `multiaddr=${peer.toString()}`
          this.config.logger.debug(
            `Peer doesn't support protocol=${protocol} ${peerInfo} ${err.stack}`
          )
        }
      })
    )
    this.server = server
    this.connected = true
  }
}
