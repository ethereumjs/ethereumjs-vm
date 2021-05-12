import events from 'events'
import { LevelUp } from 'levelup'
import { MultiaddrLike } from './types'
import { Config } from './config'
import { FullEthereumService, LightEthereumService, BeamEthereumService } from './service'

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

  public services: (FullEthereumService | LightEthereumService | BeamEthereumService)[]

  public opened: boolean
  public started: boolean

  /**
   * Create new node
   * @param {EthereumClientOptions}
   */
  constructor(options: EthereumClientOptions) {
    super()

    this.config = options.config

    switch (this.config.syncmode) {
      case 'full':
        this.services = [
          new FullEthereumService({
            config: this.config,
            chainDB: options.chainDB,
            stateDB: options.stateDB,
          }),
        ]
        break
      case 'light':
        this.services = [
          new LightEthereumService({
            config: this.config,
            chainDB: options.chainDB,
          }),
        ]
        break
      case 'beam':
        this.services = [
          new BeamEthereumService({
            config: this.config,
            chainDB: options.chainDB,
            stateDB: options.stateDB,
          }),
        ]
        break
      default:
        throw new Error(`${this.config.syncmode} is not a supported sync mode`)
    }
    this.opened = false
    this.started = false
  }

  /**
   * Open node. Must be called before node is started
   * @return {Promise}
   */
  async open() {
    if (this.opened) {
      return false
    }
    this.config.servers.map((s) => {
      s.on('error', (error: Error) => {
        this.emit('error', error)
      })
      s.on('listening', (details: any) => {
        this.emit('listening', details)
      })
    })
    this.services.map((s) => {
      s.on('error', (error: Error) => {
        this.emit('error', error)
      })
      s.on('synchronized', () => {
        this.emit('synchronized')
      })
    })
    await Promise.all(this.services.map((s) => s.open()))
    this.opened = true
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
