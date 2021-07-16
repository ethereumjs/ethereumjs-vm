import events from 'events'
import { MultiaddrLike } from './types'
import { Config } from './config'
import { FullEthereumService, LightEthereumService } from './service'
import { Event } from './types'
// eslint-disable-next-line implicit-dependencies/no-implicit
import type { LevelUp } from 'levelup'

export interface EthereumClientOptions {
  /* Client configuration */
  config: Config

  /**
   * Database to store blocks and metadata. Should be an abstract-leveldown compliant store.
   *
   * Default: Database created by the Blockchain class
   */
  chainDB?: LevelUp

  /**
   * Database to store the state. Should be an abstract-leveldown compliant store.
   *
   * Default: Database created by the Trie class
   */
  stateDB?: LevelUp

  /* List of bootnodes to use for discovery */
  bootnodes?: MultiaddrLike[]

  /* List of supported clients */
  clientFilter?: string[]

  /* How often to discover new peers */
  refreshInterval?: number
}

/**
 * Represents the top-level ethereum node, and is responsible for managing the
 * lifecycle of included services.
 * @memberof module:node
 */
export default class EthereumClient extends events.EventEmitter {
  public config: Config

  public services: (FullEthereumService | LightEthereumService)[]

  public opened: boolean
  public started: boolean
  public synchronized: boolean

  /**
   * Create new node
   * @param {EthereumClientOptions}
   */
  constructor(options: EthereumClientOptions) {
    super()

    this.config = options.config

    this.services = [
      this.config.syncmode === 'full'
        ? new FullEthereumService({
            config: this.config,
            chainDB: options.chainDB,
            stateDB: options.stateDB,
          })
        : new LightEthereumService({
            config: this.config,
            chainDB: options.chainDB,
          }),
    ]
    this.opened = false
    this.started = false
    this.synchronized = false
  }

  /**
   * Open node. Must be called before node is started
   * @return {Promise}
   */
  async open() {
    if (this.opened) {
      return false
    }

    this.config.events.on(Event.SERVER_ERROR, (error: Error) => {
      this.config.logger.warn(`Server error: ${error.name} - ${error.message}`)
    })

    this.config.events.on(Event.SERVER_LISTENING, (details: any) => {
      this.config.logger.info(`Server listening: ${details.transport} - ${details.url}`)
    })
    await Promise.all(this.services.map((s) => s.open()))
    this.opened = true
    this.config.events.on(Event.SYNC_SYNCHRONIZED, () => (this.synchronized = true))
  }

  /**
   * Starts node and all services and network servers.
   * @return {Promise}
   */
  async start() {
    if (this.started) {
      return false
    }
    await Promise.all(this.services.map((s) => s.start()))
    await Promise.all(this.config.servers.map((s) => s.start()))
    await Promise.all(this.config.servers.map((s) => s.bootstrap()))
    this.started = true
  }

  /**
   * Stops node and all services and network servers.
   * @return {Promise}
   */
  async stop() {
    if (!this.started) {
      return false
    }
    await Promise.all(this.services.map((s) => s.stop()))
    await Promise.all(this.config.servers.map((s) => s.stop()))
    this.started = false
  }

  /**
   * Returns the service with the specified name.
   * @param {string} name name of service
   * @return {Service}
   */
  service(name: string) {
    return this.services.find((s) => s.name === name)
  }

  /**
   * Returns the server with the specified name.
   * @param {string} name name of server
   * @return {Server}
   */
  server(name: string) {
    return this.config.servers.find((s) => s.name === name)
  }
}
