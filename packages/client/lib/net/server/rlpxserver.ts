import { RLPx as Devp2pRLPx, Peer as Devp2pRLPxPeer, DPT as Devp2pDPT } from '@ethereumjs/devp2p'
import { RlpxPeer } from '../peer/rlpxpeer'
import { Server, ServerOptions } from './server'
import { Event } from '../../types'

export interface RlpxServerOptions extends ServerOptions {
  /* List of supported clients */
  clientFilter?: string[]
}

const ignoredErrors = new RegExp(
  [
    // Peer socket connection
    'ECONNRESET',
    'EPIPE', // (?)
    'ETIMEDOUT', // (?)

    // ETH status handling
    'Genesis block mismatch',
    'NetworkId mismatch',
    'Unknown fork hash',

    // DPT message decoding
    'Hash verification failed',
    'Invalid address buffer',
    'Invalid timestamp buffer',
    'Invalid type',
    'Timeout error: ping', // connection
    'Peer is banned', // connection

    // ECIES message encryption
    'Invalid MAC',

    // Client
    'Handshake timed out', // Protocol handshake
    'Server already destroyed', // Bootstrap retrigger
  ].join('|')
)

/**
 * DevP2P/RLPx server
 * @emits connected
 * @emits disconnected
 * @emits error
 * @memberof module:net/server
 */
export class RlpxServer extends Server {
  private peers: Map<string, RlpxPeer> = new Map()

  public discovery: boolean
  private clientFilter: string[]

  public rlpx: Devp2pRLPx | null = null
  public dpt: Devp2pDPT | null = null
  public ip: string = '::'

  /**
   * Create new DevP2P/RLPx server
   * @param {RlpxServerOptions}
   */
  constructor(options: RlpxServerOptions) {
    super(options)

    // TODO: get the external ip from the upnp service
    this.ip = '::'
    this.discovery = options.config.discV4 || options.config.discDns
    this.clientFilter = options.clientFilter ?? [
      'go1.5',
      'go1.6',
      'go1.7',
      'quorum',
      'pirl',
      'ubiq',
      'gmc',
      'gwhale',
      'prichain',
    ]
  }

  /**
   * Server name
   * @type {string}
   */
  get name() {
    return 'rlpx'
  }

  /**
   * Return Rlpx info
   */
  getRlpxInfo() {
    // TODO: return undefined? note that this.rlpx might be undefined if called before initRlpx
    if (!this.rlpx) {
      return {
        enode: undefined,
        id: undefined,
        ip: this.ip,
        listenAddr: `[${this.ip}]:${this.config.port}`,
        ports: { discovery: this.config.port, listener: this.config.port },
      }
    }
    const id = this.rlpx._id.toString('hex')
    return {
      enode: `enode://${id}@[${this.ip}]:${this.config.port}`,
      id: id,
      ip: this.ip,
      listenAddr: `[${this.ip}]:${this.config.port}`,
      ports: { discovery: this.config.port, listener: this.config.port },
    }
  }

  /**
   * Start Devp2p/RLPx server. Returns a promise that resolves once server has been started.
   * @return Resolves with true if server successfully started
   */
  async start(): Promise<boolean> {
    if (this.started) {
      return false
    }
    await super.start()
    await this.initDpt()
    await this.initRlpx()
    this.started = true

    return true
  }

  /**
   * Bootstrap bootnode and DNS mapped peers from the network
   */
  async bootstrap(): Promise<void> {
    const self = this

    // Bootnodes
    let promises = this.bootnodes.map((ma) => {
      const { address, port } = ma.nodeAddress()
      const bootnode = {
        address,
        udpPort: Number(port),
        tcpPort: Number(port),
      }
      return this.dpt!.bootstrap(bootnode)
    })

    // DNS peers
    if (this.config.discDns) {
      const dnsPeers = (await this.dpt?.getDnsPeers()) ?? []
      promises = promises.concat(dnsPeers.map((node) => self.dpt!.bootstrap(node)))
    }

    for (const promise of promises) {
      try {
        await promise
      } catch (e) {
        this.error(e)
      }
    }
  }

  /**
   * Stop Devp2p/RLPx server. Returns a promise that resolves once server has been stopped.
   */
  async stop(): Promise<boolean> {
    if (this.started) {
      this.rlpx!.destroy()
      this.dpt!.destroy()
      await super.stop()
      this.started = false
    }
    return this.started
  }

  /**
   * Ban peer for a specified time
   * @param  peerId id of peer
   * @param  [maxAge] how long to ban peer
   * @return True if ban was successfully executed
   */
  ban(peerId: string, maxAge = 60000): boolean {
    if (!this.started) {
      return false
    }
    this.dpt!.banPeer(peerId, maxAge)
    return true
  }

  /**
   * Handles errors from server and peers
   * @private
   * @param  error
   * @param  {Peer} peer
   * @emits  error
   */
  error(error: Error) {
    if (ignoredErrors.test(error.message)) {
      return
    }
    this.config.events.emit(Event.SERVER_ERROR, error, this)
  }

  /**
   * Initializes DPT for peer discovery
   * @private
   */
  async initDpt() {
    return new Promise<void>((resolve) => {
      this.dpt = new Devp2pDPT(this.key, {
        refreshInterval: this.refreshInterval,
        endpoint: {
          address: '0.0.0.0',
          udpPort: null,
          tcpPort: null,
        },
        shouldFindNeighbours: this.config.discV4,
        shouldGetDnsPeers: this.config.discDns,
        dnsRefreshQuantity: this.config.maxPeers,
        dnsNetworks: this.dnsNetworks,
        dnsAddr: this.config.dnsAddr,
      })

      this.dpt.on('error', (e: Error) => this.error(e))

      this.dpt.on('listening', () => {
        resolve()
      })

      if (this.config.port) {
        this.dpt.bind(this.config.port, '0.0.0.0')
      }
    })
  }

  /**
   * Initializes RLPx instance for peer management
   * @private
   */
  async initRlpx() {
    return new Promise<void>((resolve) => {
      this.rlpx = new Devp2pRLPx(this.key, {
        dpt: this.dpt!,
        maxPeers: this.config.maxPeers,
        capabilities: RlpxPeer.capabilities(Array.from(this.protocols)),
        remoteClientIdFilter: this.clientFilter,
        listenPort: this.config.port,
        common: this.config.chainCommon,
      })

      this.rlpx.on('peer:added', async (rlpxPeer: Devp2pRLPxPeer) => {
        const peer = new RlpxPeer({
          config: this.config,
          id: rlpxPeer.getId()!.toString('hex'),
          host: rlpxPeer._socket.remoteAddress!,
          port: rlpxPeer._socket.remotePort!,
          protocols: Array.from(this.protocols),
          // @ts-ignore: Property 'server' does not exist on type 'Socket'.
          // TODO: check this error
          inbound: !!rlpxPeer._socket.server,
        })
        try {
          await peer.accept(rlpxPeer, this)
          this.peers.set(peer.id, peer)
          this.config.logger.debug(`Peer connected: ${peer}`)
          this.config.events.emit(Event.PEER_CONNECTED, peer)
        } catch (error) {
          this.error(error)
        }
      })

      this.rlpx.on('peer:removed', (rlpxPeer: Devp2pRLPxPeer, reason: any) => {
        const id = (rlpxPeer.getId() as Buffer).toString('hex')
        const peer = this.peers.get(id)
        if (peer) {
          this.peers.delete(peer.id)
          this.config.logger.debug(
            `Peer disconnected (${rlpxPeer.getDisconnectPrefix(reason)}): ${peer}`
          )
          this.config.events.emit(Event.PEER_DISCONNECTED, peer)
        }
      })

      this.rlpx.on('peer:error', (rlpxPeer: any, error: Error) => {
        const peerId = rlpxPeer && rlpxPeer.getId()
        if (!peerId) {
          return this.error(error)
        }
        this.error(error)
      })

      this.rlpx.on('error', (e: Error) => this.error(e))

      this.rlpx.on('listening', () => {
        this.config.events.emit(Event.SERVER_LISTENING, {
          transport: this.name,
          url: this.getRlpxInfo().enode,
        })
        resolve()
      })

      if (this.config.port) {
        this.rlpx.listen(this.config.port, '0.0.0.0')
      }
    })
  }
}
