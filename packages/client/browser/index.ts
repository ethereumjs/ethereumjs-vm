import Common from '@ethereumjs/common'

// Blockchain
export * from '../lib/blockchain/chain'

// Peer
export * from '../lib/net/peer/peer'
export * from '../lib/net/peer/libp2ppeer'
export * from './libp2pnode'

// Peer Pool
export * from '../lib/net/peerpool'

// Protocol
export * from '../lib/net/protocol/protocol'
export * from '../lib/net/protocol/ethprotocol'
export * from '../lib/net/protocol/lesprotocol'
export * from '../lib/net/protocol/flowcontrol'

// Server
export * from '../lib/net/server/server'
export * from '../lib/net/server/libp2pserver'
import { Libp2pServer } from '../lib/net/server/libp2pserver'

// EthereumClient
export * from '../lib/client'
import EthereumClient from '../lib/client'

// Service
export * from '../lib/service/service'
export * from '../lib/service/fullethereumservice'
export * from '../lib/service/lightethereumservice'

// Synchronizer
export * from '../lib/sync/sync'
export * from '../lib/sync/fullsync'
export * from '../lib/sync/lightsync'

// Utilities
export * from '../lib/util'
import { Config } from '../lib/config'
import { Event } from '../lib/types'

// Logging
export * from './logging'
import { getLogger } from './logging'

export async function createClient(args: any) {
  const logger = getLogger({ loglevel: args.loglevel ?? 'info' })
  const datadir = args.datadir ?? Config.DATADIR_DEFAULT
  const common = new Common({ chain: args.network ?? 'mainnet' })
  const key = await Config.getClientKey(datadir, common)
  const config = new Config({
    common,
    key,
    servers: [new Libp2pServer({ multiaddrs: [], config: new Config({ key, logger }), ...args })],
    syncmode: args.syncmode ?? 'full',
    logger,
  })
  return new EthereumClient({ config })
}

export async function run(args: any) {
  const client = await createClient(args)
  const { logger, chainCommon: common } = client.config
  logger.info('Initializing Ethereumjs client...')
  logger.info(`Connecting to network: ${common.chainName()}`)
  client.config.events.on(Event.SERVER_ERROR, (err: any) => logger.error(err))
  client.config.events.on(Event.SERVER_LISTENING, (details: any) => {
    logger.info(`Listener up transport=${details.transport} url=${details.url}`)
  })
  client.config.events.on(Event.SYNC_SYNCHRONIZED, (height) => {
    logger.info(`Synchronized blockchain at height ${height.toNumber}`)
  })
  await client.open()
  logger.info('Synchronizing blockchain...')
  await client.start()
  return client
}
