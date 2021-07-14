import { EthereumService, EthereumServiceOptions } from './ethereumservice'
import { FullSynchronizer } from '../sync/fullsync'
import { EthProtocol } from '../net/protocol/ethprotocol'
import { LesProtocol } from '../net/protocol/lesprotocol'
import { WitProtocol } from '../net/protocol/witprotocol'
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
    if (this.config.wit) {
      protocols.push(
        new WitProtocol({
          config: this.config,
          chain: this.chain,
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
    } else if (protocol === 'les') {
      return this.handleLes(message, peer)
    } else if (protocol === 'wit') {
      return this.handleWit(message, peer)
    } else {
      throw new Error(`Unknown protocol: ${protocol}`)
    }
  }

  /**
   * Handles incoming ETH message from connected peer
   * @param  {Object}  message message object
   * @param  peer peer
   */
  async handleEth(message: any, peer: Peer): Promise<void> {
    if (message.name === 'GetBlockHeaders') {
      const { reqId, block, max, skip, reverse } = message.data
      const headers: any = await this.chain.getHeaders(block, max, skip, reverse)
      peer.eth!.send('BlockHeaders', { reqId, headers })
    } else if (message.name === 'GetBlockBodies') {
      const { reqId, hashes } = message.data
      const blocks = await Promise.all(hashes.map((hash: any) => this.chain.getBlock(hash)))
      const bodies: any = blocks.map((block: any) => block.raw().slice(1))
      peer.eth!.send('BlockBodies', { reqId, bodies })
    } else if (message.name === 'NewBlockHashes') {
      await this.synchronizer.announced(message.data, peer)
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

  /**
   * Handles incoming WIT message from connected peer
   * @param message message object
   * @param peer peer
   */
  async handleWit(message: any, peer: Peer): Promise<void> {
    if (message.name === 'GetBlockWitnessHashes' && this.config.wit) {
      const { reqId, blockHash } = message.data
      const block = await this.chain.getBlock(blockHash)
      const parentBlock = await this.chain.getBlock(block.header.parentHash)

      let witnessHashes: string[] = []

      // wit/0 spec notes:
      // * Nodes must always respond to the query.
      // * If the node does not have the requested block, it must return an empty reply.

      // TODO getBlock should return Promise<Block | null>
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (block && parentBlock) {
        // copy the vm as to not cause any changes during runBlock
        const vm = this.synchronizer.execution.vm.copy()

        try {
          const result = await vm.runBlock({
            block,
            root: parentBlock.header.stateRoot,
            reportWitness: true,
          })
          if (result.witnessHashes) {
            witnessHashes = result.witnessHashes
          }
        } catch (error) {
          // if this fails, follow spec by returning witnessHashes as empty
        }
      }

      peer.wit!.send('BlockWitnessHashes', { reqId, witnessHashes })
    }
  }
}
