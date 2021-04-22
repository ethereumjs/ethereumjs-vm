import { Config } from '../../lib/config'
import { FullEthereumService, LightEthereumService } from '../../lib/service'
import MockServer from './mocks/mockserver'
import MockChain from './mocks/mockchain'
import Blockchain from '@ethereumjs/blockchain'

interface SetupOptions {
  location?: string
  height?: number
  interval?: number
  syncmode?: string
}

export async function setup(
  options: SetupOptions = {}
): Promise<[MockServer, FullEthereumService | LightEthereumService]> {
  const { location, height, interval, syncmode } = options

  const loglevel = 'error'
  const lightserv = syncmode === 'full'
  const config = new Config({ loglevel, syncmode, lightserv })

  const server = new MockServer({ config, location })
  const blockchain = await Blockchain.create({
    validateBlocks: false,
    validateConsensus: false,
  })
  const chain = new MockChain({ config, blockchain, height })

  const servers = [server] as any
  const serviceConfig = new Config({ loglevel, syncmode, servers, lightserv, minPeers: 1 })
  const serviceOpts = {
    config: serviceConfig,
    chain,
    interval: interval ?? 10,
  }

  let service
  if (syncmode === 'light') {
    service = new LightEthereumService(serviceOpts)
  } else {
    service = new FullEthereumService({
      ...serviceOpts,
      lightserv: true,
    })
  }
  await service.open()
  if ('execution' in service.synchronizer) {
    service.synchronizer.execution.syncing = false
  }
  await service.start()

  return [server, service]
}

export async function destroy(
  server: MockServer,
  service: FullEthereumService | LightEthereumService
): Promise<void> {
  await server.stop()
  await service.stop()
}

export async function wait(delay: number) {
  await new Promise((resolve) => setTimeout(resolve, delay))
}
