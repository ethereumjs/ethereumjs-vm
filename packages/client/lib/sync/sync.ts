import { EventEmitter } from 'events'
import { PeerPool } from '../net/peerpool'
import { Peer } from '../net/peer/peer'
import { FlowControl } from '../net/protocol'
import { Config } from '../config'
import { Chain } from '../blockchain'
import { Event } from '../types'
// eslint-disable-next-line implicit-dependencies/no-implicit
import type { LevelUp } from 'levelup'

export interface SynchronizerOptions {
  /* Config */
  config: Config

  /* Peer pool */
  pool: PeerPool

  /* Blockchain */
  chain: Chain

  /* State database */
  stateDB?: LevelUp

  /* Flow control manager */
  flow?: FlowControl

  /* Refresh interval in ms (default: 1000) */
  interval?: number
}

/**
 * Base class for blockchain synchronizers
 * @memberof module:sync
 */
export abstract class Synchronizer extends EventEmitter {
  public config: Config

  protected pool: PeerPool
  protected chain: Chain
  protected flow: FlowControl
  protected interval: number
  public running: boolean
  protected forceSync: boolean
  public startingBlock: number

  /**
   * Create new node
   * @param {SynchronizerOptions}
   */
  constructor(options: SynchronizerOptions) {
    super()

    this.config = options.config

    this.pool = options.pool
    this.chain = options.chain
    this.flow = options.flow ?? new FlowControl()
    this.interval = options.interval ?? 1000
    this.running = false
    this.forceSync = false
    this.startingBlock = 0

    this.config.events.on(Event.POOL_PEER_ADDED, (peer: Peer) => {
      if (this.syncable(peer)) {
        this.config.logger.debug(`Found ${this.type} peer: ${peer}`)
      }
    })
  }

  abstract sync(): Promise<boolean>

  /**
   * Returns synchronizer type
   */
  get type(): string {
    return 'sync'
  }

  /**
   * Open synchronizer. Must be called before sync() is called
   * @return {Promise}
   */
  async open() {}

  /**
   * Returns true if peer can be used for syncing
   * @return {boolean}
   */
  // TODO: evaluate syncability of peer
  syncable(_peer: Peer): boolean {
    return true
  }

  /**
   * Start synchronization
   */
  async start(): Promise<void | boolean> {
    if (this.running) {
      return false
    }
    this.running = true
    const timeout = setTimeout(() => {
      this.forceSync = true
    }, this.interval * 30)
    while (this.running) {
      try {
        if (await this.sync()) {
          this.config.events.emit(Event.SYNC_SYNCHRONIZED, this.chain.blocks.height)
        }
      } catch (error) {
        this.config.events.emit(Event.SYNC_ERROR, error)
      }
      await new Promise((resolve) => setTimeout(resolve, this.interval))
    }
    this.running = false
    clearTimeout(timeout)
  }

  /**
   * Stop synchronization. Returns a promise that resolves once stopped.
   */
  async stop(): Promise<boolean> {
    if (!this.running) {
      return false
    }
    await new Promise((resolve) => setTimeout(resolve, this.interval))
    this.running = false
    this.config.logger.info('Stopped synchronization.')
    return true
  }
}
