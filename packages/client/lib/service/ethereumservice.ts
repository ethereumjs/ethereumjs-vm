import { FlowControl } from '../net/protocol/flowcontrol'
import { Chain } from '../blockchain'
import { Service, ServiceOptions } from './service'
import { Synchronizer } from '../sync'
// eslint-disable-next-line implicit-dependencies/no-implicit
import type { LevelUp } from 'levelup'

export interface EthereumServiceOptions extends ServiceOptions {
  /* Blockchain */
  chain?: Chain

  /* Blockchain database */
  chainDB?: LevelUp

  /* State database */
  stateDB?: LevelUp

  /* Sync retry interval in ms (default: 8000) */
  interval?: number

  /* Protocol timeout in ms (default: 6000) */
  timeout?: number
}

/**
 * Ethereum service
 * @memberof module:service
 */
export class EthereumService extends Service {
  public flow: FlowControl
  public chain: Chain
  public interval: number
  public timeout: number
  public synchronizer!: Synchronizer

  /**
   * Create new ETH service
   * @param {EthereumServiceOptions}
   */
  constructor(options: EthereumServiceOptions) {
    super(options)

    this.flow = new FlowControl()
    this.chain = options.chain ?? new Chain(options)
    this.interval = options.interval ?? 8000
    this.timeout = options.timeout ?? 6000
  }

  /**
   * Service name
   * @protected
   * @type {string}
   */
  get name() {
    return 'eth'
  }

  /**
   * Open eth service. Must be called before service is started
   * @return {Promise}
   */
  async open() {
    if (this.opened) {
      return false
    }
    await super.open()
    await this.chain.open()
    await this.synchronizer.open()
  }

  /**
   * Starts service and ensures blockchain is synchronized. Returns a promise
   * that resolves once the service is started and blockchain is in sync.
   * @return {Promise}
   */
  async start(): Promise<void | boolean> {
    if (this.running) {
      return false
    }
    await super.start()
    this.synchronizer.start() // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  /**
   * Stop service. Interrupts blockchain synchronization if its in progress.
   * @return {Promise}
   */
  async stop(): Promise<void | boolean> {
    if (!this.running) {
      return false
    }
    await this.synchronizer.stop()
    await super.stop()
  }
}
