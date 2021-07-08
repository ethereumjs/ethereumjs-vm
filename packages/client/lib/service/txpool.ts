import EventEmitter from 'events'
import { Config } from '../config'
import { Peer } from '../net/peer'
import { EthProtocolMethods } from '../net/protocol'
// import { TransactionFactory } from '@ethereumjs/tx'

export interface TxPoolOptions {
  /* Config */
  config: Config
}

const TX_RETRIEVAL_LIMIT = 256

/**
 * @module service
 */

/**
 * Tx pool (mempool)
 * @memberof module:service
 */
export class TxPool extends EventEmitter {
  public config: Config

  private opened: boolean

  /**
   * Create new tx pool
   * @param options constructor parameters
   */
  constructor(options: TxPoolOptions) {
    super()

    this.config = options.config

    //this.pool = new Map<string, Peer>()
    this.opened = false

    this.init()
  }

  init() {
    this.opened = false
  }

  /**
   * Open pool
   */
  async open(): Promise<boolean> {
    if (this.opened) {
      return false
    }
    this.opened = true
    return true
  }

  /**
   * New pooled txs announced
   * @param  announcements new block hash announcements
   * @param  peer peer
   */
  async announced(txHashes: Buffer[], peer: Peer) {
    if (txHashes.length) {
      this.config.logger.info(`Tx pool: received new pooled tx hashes number=${txHashes.length}`)
      const txs = await (peer!.eth as EthProtocolMethods).getPooledTransactions(
        txHashes.slice(0, TX_RETRIEVAL_LIMIT)
      )
      this.config.logger.info(`Tx pool: received txs number=${txs.length}`)
      /*for (const txData of txs) {
        const tx = TransactionFactory.fromBlockBodyData(txData)
      }*/
    }
  }

  /**
   * Close pool
   */
  async close() {
    //this.pool.clear()
    this.opened = false
  }
}
