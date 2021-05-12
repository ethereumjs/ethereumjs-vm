import Common from '@ethereumjs/common'
import VM from '@ethereumjs/vm'
import { genPrivateKey } from '@ethereumjs/devp2p'
import Multiaddr from 'multiaddr'
import { getLogger, Logger } from './logging'
import { Libp2pServer, RlpxServer } from './net/server'
import { parseTransports } from './util'
import type { LevelUp } from 'levelup'
const level = require('level')

export interface ConfigOptions {
  /**
   * Specify the chain by providing a common instance,
   * common instance will not be modified by client
   *
   * Default: 'mainnet' Common
   */
  common?: Common

  /**
   * Synchronization mode ('full' or 'light')
   *
   * Default: 'full'
   */
  syncmode?: string

  /**
   * Provide a custom VM instance to process blocks
   *
   * Default: VM instance created by client
   */
  vm?: VM

  /**
   * Serve light peer requests
   *
   * Default: `false`
   */
  lightserv?: boolean

  /**
   * Root data directory for the blockchain
   */
  datadir?: string

  /**
   * Private key for the client.
   * Use return value of `await Config.getClientKey(datadir, common)`
   * If left blank, a random key will be generated and used.
   */
  key?: Buffer

  /**
   * Network transports ('rlpx' and/or 'libp2p')
   *
   * Default: `['rlpx', 'libp2p']`
   */
  transports?: string[]

  /**
   * Network bootnodes
   * (e.g. abc@18.138.108.67 or /ip4/127.0.0.1/tcp/50505/p2p/QmABC)
   */
  bootnodes?: Multiaddr[]

  /**
   * RLPx listening port
   *
   * Default: `30303`
   */
  port?: number

  /**
   * Network multiaddrs for libp2p
   * (e.g. /ip4/127.0.0.1/tcp/50505/p2p/QmABC)
   */
  multiaddrs?: Multiaddr[]

  /**
   * Transport servers (RLPx or Libp2p)
   * Use `transports` option, only used for testing purposes
   *
   * Default: servers created from `transports` option
   */
  servers?: (RlpxServer | Libp2pServer)[]

  /**
   * Enable the JSON-RPC server
   *
   * Default: false
   */
  rpc?: boolean

  /**
   * HTTP-RPC server listening port
   *
   * Default: 8545
   */
  rpcport?: number

  /**
   * HTTP-RPC server listening interface
   */
  rpcaddr?: string

  /**
   * Logging verbosity
   *
   * Choices: ['debug', 'info', 'warn', 'error', 'off']
   * Default: 'info'
   */
  loglevel?: string

  /**
   * A custom winston logger can be provided
   * if setting logging verbosity is not sufficient
   *
   * Default: Logger with loglevel 'info'
   */
  logger?: Logger

  /**
   * Number of peers needed before syncing
   *
   * Default: `2`
   */
  minPeers?: number

  /**
   * Maximum peers allowed
   *
   * Default: `25`
   */
  maxPeers?: number

  /**
   * DNS server to query DNS TXT records from for peer discovery
   *
   * Default `8.8.8.8` (Google)
   */
  dnsAddr?: string

  /**
   * EIP-1459 ENR Tree urls to query via DNS for peer discovery
   */
  dnsNetworks?: string[]

  /**
   * Generate code for local debugging, currently providing a
   * code snippet which can be used to run blocks on the
   * EthereumJS VM on execution errors
   *
   * (meant to be used internally for the most part)
   */
  debugCode?: boolean

  /**
   * Query EIP-1459 DNS TXT records for peer discovery
   *
   * Default: `true` for testnets, false for mainnet
   */
  discDns?: boolean

  /**
   * Use v4 ("findneighbour" node requests) for peer discovery
   *
   * Default: `false` for testnets, true for mainnet
   */
  discV4?: boolean
}

export class Config {
  public static readonly CHAIN_DEFAULT = 'mainnet'
  public static readonly SYNCMODE_DEFAULT = 'full'
  public static readonly LIGHTSERV_DEFAULT = false
  public static readonly DATADIR_DEFAULT = `./datadir`
  public static readonly TRANSPORTS_DEFAULT = ['rlpx', 'libp2p']
  public static readonly PORT_DEFAULT = 30303
  public static readonly RPC_DEFAULT = false
  public static readonly RPCPORT_DEFAULT = 8545
  public static readonly RPCADDR_DEFAULT = 'localhost'
  public static readonly LOGLEVEL_DEFAULT = 'info'
  public static readonly MINPEERS_DEFAULT = 1
  public static readonly MAXPEERS_DEFAULT = 25
  public static readonly DNSADDR_DEFAULT = '8.8.8.8'
  public static readonly DEBUGCODE_DEFAULT = false

  public readonly logger: Logger
  public readonly syncmode: string
  public readonly vm?: VM
  public readonly lightserv: boolean
  public readonly datadir: string
  public readonly key: Buffer
  public readonly transports: string[]
  public readonly bootnodes?: Multiaddr[]
  public readonly port?: number
  public readonly multiaddrs?: Multiaddr[]
  public readonly rpc: boolean
  public readonly rpcport: number
  public readonly rpcaddr: string
  public readonly loglevel: string
  public readonly minPeers: number
  public readonly maxPeers: number
  public readonly dnsAddr: string
  public readonly debugCode: boolean
  public readonly discDns: boolean
  public readonly discV4: boolean

  public readonly chainCommon: Common
  public readonly execCommon: Common

  public readonly servers: (RlpxServer | Libp2pServer)[] = []

  constructor(options: ConfigOptions = {}) {
    this.syncmode = options.syncmode ?? Config.SYNCMODE_DEFAULT
    this.vm = options.vm
    this.lightserv = options.lightserv ?? Config.LIGHTSERV_DEFAULT
    this.transports = options.transports ?? Config.TRANSPORTS_DEFAULT
    this.bootnodes = options.bootnodes
    this.port = options.port ?? Config.PORT_DEFAULT
    this.multiaddrs = options.multiaddrs
    this.datadir = options.datadir ?? Config.DATADIR_DEFAULT
    this.key = options.key ?? genPrivateKey()
    this.rpc = options.rpc ?? Config.RPC_DEFAULT
    this.rpcport = options.rpcport ?? Config.RPCPORT_DEFAULT
    this.rpcaddr = options.rpcaddr ?? Config.RPCADDR_DEFAULT
    this.loglevel = options.loglevel ?? Config.LOGLEVEL_DEFAULT
    this.minPeers = options.minPeers ?? Config.MINPEERS_DEFAULT
    this.maxPeers = options.maxPeers ?? Config.MAXPEERS_DEFAULT
    this.dnsAddr = options.dnsAddr ?? Config.DNSADDR_DEFAULT
    this.debugCode = options.debugCode ?? Config.DEBUGCODE_DEFAULT

    // TODO: map chainParams (and lib/util.parseParams) to new Common format
    const common =
      options.common ?? new Common({ chain: Config.CHAIN_DEFAULT, hardfork: 'chainstart' })
    this.chainCommon = common.copy()
    this.execCommon = common.copy()

    this.discDns = this.getDnsDiscovery(options.discDns)
    this.discV4 = this.getV4Discovery(options.discV4)

    if (options.logger) {
      if (options.loglevel) {
        throw new Error('Config initialization with both logger and loglevel options not allowed')
      }

      // Logger option takes precedence
      this.logger = options.logger
    } else {
      this.logger = getLogger({ loglevel: this.loglevel })
    }

    if (options.servers) {
      if (options.transports) {
        throw new Error(
          'Config initialization with both servers and transports options not allowed'
        )
      }
      // Servers option takes precedence
      this.servers = options.servers
    } else {
      // Otherwise parse transports from transports option
      this.servers = parseTransports(this.transports).map((t) => {
        if (t.name === 'rlpx') {
          const bootnodes = this.bootnodes ?? this.chainCommon.bootstrapNodes()
          const dnsNetworks = options.dnsNetworks ?? this.chainCommon.dnsNetworks()
          return new RlpxServer({ config: this, bootnodes, dnsNetworks })
        } else if (t.name === 'libp2p') {
          const multiaddrs = this.multiaddrs
          const bootnodes = this.bootnodes
          return new Libp2pServer({ config: this, multiaddrs, bootnodes })
        } else {
          throw new Error(`unknown transport: ${t.name}`)
        }
      })
    }
  }

  /**
   * Returns the network directory for the chain.
   */
  getNetworkDirectory(): string {
    const networkDirName = this.chainCommon.chainName()
    const dataDir = `${this.datadir}/${networkDirName}`
    return dataDir
  }

  /**
   * Returns the directory for storing the client chain data
   * based on syncmode and selected chain (subdirectory of 'datadir')
   */
  getChainDataDirectory(): string {
    const chainDataDirName = this.syncmode === 'light' ? 'lightchain' : 'chain'
    const dataDir = `${this.getNetworkDirectory()}/${chainDataDirName}`
    return dataDir
  }

  /**
   * Returns the directory for storing the client state data
   * based selected chain (subdirectory of 'datadir')
   */
  getStateDataDirectory(mode?: string): string {
    // TODO: do not construct DB instance in CLI, instead create it when necessary (?)
    if (mode === 'beamsync') {
      return `${this.getNetworkDirectory()}/beamstate`
    } else {
      return `${this.getNetworkDirectory()}/state`
    }
  }

  /**
   * Returns the config level db.
   */
  static getConfigDB(networkDir: string): LevelUp {
    const db = level(`${networkDir}/config` as any)
    return db
  }

  /**
   * Gets the client private key from the config db.
   */
  static async getClientKey(datadir: string, common: Common) {
    const networkDir = `${datadir}/${common.chainName()}`
    const db = this.getConfigDB(networkDir)
    const encodingOpts = { keyEncoding: 'utf8', valueEncoding: 'binary' }
    const dbKey = 'config:client_key'
    let key
    try {
      key = await db.get(dbKey, encodingOpts)
    } catch (error) {
      if (error.type === 'NotFoundError') {
        // generate and save a new key
        key = genPrivateKey()
        await db.put(dbKey, key, encodingOpts)
      }
    }
    return key
  }

  /**
   * Returns specified option or the default setting for whether DNS-based peer discovery
   * is enabled based on chainName. `true` for ropsten, rinkeby, and goerli
   */
  getDnsDiscovery(option: boolean | undefined): boolean {
    if (option !== undefined) return option
    const dnsNets = ['ropsten', 'rinkeby', 'goerli']
    return dnsNets.includes(this.chainCommon.chainName())
  }

  /**
   * Returns specified option or the default setting for whether v4 peer discovery
   * is enabled based on chainName. `true` for `mainnet`
   */
  getV4Discovery(option: boolean | undefined): boolean {
    if (option !== undefined) return option
    return this.chainCommon.chainName() === 'mainnet'
  }
}
