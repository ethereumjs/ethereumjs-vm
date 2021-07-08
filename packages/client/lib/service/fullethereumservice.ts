import { EthereumService, EthereumServiceOptions } from './ethereumservice'
import { FullSynchronizer } from '../sync/fullsync'
import { EthProtocol } from '../net/protocol/ethprotocol'
import { LesProtocol } from '../net/protocol/lesprotocol'
import { Peer } from '../net/peer/peer'
import { Protocol } from '../net/protocol'

interface FullEthereumServiceOptions extends EthereumServiceOptions {
  /* Serve LES requests (default: false) */
  lightserv?: boolean
}

/**
 * Full Ethereum service
 * @memberof module:service
 */
export class FullEthereumService extends EthereumService {
  public synchronizer: FullSynchronizer
  public lightserv: boolean

  /**
   * Create new ETH service
   * @param {FullEthereumServiceOptions}
   */
  constructor(options: FullEthereumServiceOptions) {
    super(options)

    this.lightserv = options.lightserv ?? false

    this.config.logger.info('Full sync mode')

    this.synchronizer = new FullSynchronizer({
      config: this.config,
      pool: this.pool,
      chain: this.chain,
      stateDB: options.stateDB,
      interval: this.interval,
    })
  }

  /**
   * Returns all protocols required by this service
   * @type {Protocol[]} required protocols
   */
  get protocols(): Protocol[] {
    const protocols: Protocol[] = [
      new EthProtocol({
        config: this.config,
        chain: this.chain,
        timeout: this.timeout,
      }),
    ]
    if (this.config.lightserv) {
      protocols.push(
        new LesProtocol({
          config: this.config,
          chain: this.chain,
          flow: this.flow,
          timeout: this.timeout,
        })
      )
    }
    return protocols
  }

  /**
   * Handles incoming message from connected peer
   * @param  {Object}  message message object
   * @param  protocol protocol name
   * @param  peer peer
   */
  async handle(message: any, protocol: string, peer: Peer): Promise<any> {
    if (protocol === 'eth') {
      return this.handleEth(message, peer)
    } else {
      return this.handleLes(message, peer)
    }
  }

  /**
   * Handles incoming ETH message from connected peer
   * @param  {Object}  message message object
   * @param  peer peer
   */
  async handleEth(message: any, peer: Peer): Promise<void> {
    if (message.name === 'GetBlockHeaders') {
      const { block, max, skip, reverse } = message.data
      const headers: any = await this.chain.getHeaders(block, max, skip, reverse)
      peer.eth!.send('BlockHeaders', headers)
    } else if (message.name === 'GetBlockBodies') {
      const hashes = message.data
      const blocks = await Promise.all(hashes.map((hash: any) => this.chain.getBlock(hash)))
      const bodies: any = blocks.map((block: any) => block.raw().slice(1))
      peer.eth!.send('BlockBodies', bodies)
    } else if (message.name === 'NewBlockHashes') {
      await this.synchronizer.announced(message.data, peer)
    } else if (message.name === 'NewPooledTransactionHashes') {
      this.txPool.announced(message.data, peer)
    }
  }

  /**
   * Handles incoming LES message from connected peer
   * @param  {Object}  message message object
   * @param  peer peer
   */
  async handleLes(message: any, peer: Peer): Promise<void> {
    if (message.name === 'GetBlockHeaders' && this.config.lightserv) {
      const { reqId, block, max, skip, reverse } = message.data
      const bv = this.flow.handleRequest(peer, message.name, max)
      if (bv < 0) {
        this.pool.ban(peer, 300000)
        this.config.logger.debug(`Dropping peer for violating flow control ${peer}`)
      } else {
        const headers: any = await this.chain.getHeaders(block, max, skip, reverse)
        peer.les!.send('BlockHeaders', { reqId, bv, headers })
      }
    }
  }
}
