import { EventEmitter } from 'events'
import { Config } from '../../config'
import { LevelUp } from 'levelup'
import { Chain } from '../../blockchain'
import { SecureTrie } from 'merkle-patricia-tree'

export interface ExecutionOptions {
  /* Config */
  config: Config

  /* State database */
  stateDB?: LevelUp

  /** Chain */
  chain: Chain

  /** Optional custom Trie */
  trie?: SecureTrie
}

export abstract class Execution extends EventEmitter {
  public config: Config

  protected stateDB?: LevelUp
  protected chain: Chain

  public running: boolean = false

  /**
   * Create new excution module
   * @memberof module:sync/execution
   */
  constructor(options: ExecutionOptions) {
    super()

    this.config = options.config
    this.chain = options.chain
    this.stateDB = options.stateDB
  }

  /**
   * Runs an execution
   *
   * @returns number quantifying execution run
   */
  abstract run(): Promise<number>

  /**
   * Stop execution. Returns a promise that resolves once stopped.
   */
  async stop(): Promise<boolean> {
    this.running = false
    this.config.logger.info('Stopped execution.')
    return true
  }
}
