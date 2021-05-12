import tape from 'tape'
import { Address, BN } from 'ethereumjs-util'
import { Config } from '../../lib/config'
import { FullEthereumService } from '../../lib/service'
import MockServer from './mocks/mockserver'
import MockChain from './mocks/mockchain'
import { destroy } from './util'
import Blockchain from '@ethereumjs/blockchain'
import VM from '@ethereumjs/vm'

tape('[Integration:FullEthereumService]', async (t) => {
  async function setup(): Promise<[MockServer, FullEthereumService]> {
    const loglevel = 'error'
    const config = new Config({ loglevel })
    const server = new MockServer({ config })
    const blockchain = new Blockchain({
      validateBlocks: false,
      validateConsensus: false,
    })
    const chain = new MockChain({ config, blockchain })
    const serviceConfig = new Config({
      loglevel,
      servers: [server as any],
      lightserv: true,
      vm: new VM(),
    })
    const service = new FullEthereumService({
      config: serviceConfig,
      chain,
    })
    // Set syncing to false to skip VM execution
    service.synchronizer.execution.syncing = false
    await service.open()
    await server.start()
    await service.start()
    return [server, service]
  }

  t.test('should handle ETH requests', async (t) => {
    const [server, service] = await setup()
    const peer = await server.accept('peer0')
    const headers = await peer.eth!.getBlockHeaders({ block: new BN(1), max: 2 })

    const address = new Address(Buffer.from('01'.repeat(20), 'hex'))
    const account = await service.config.vm!.stateManager.getAccount(address)
    account.balance = new BN(1)
    const stateManager = service.config.vm?.stateManager
    await stateManager?.checkpoint()
    await service.config.vm?.stateManager.putAccount(address, account)
    await stateManager?.commit()

    const key = Buffer.from(
      '71b6038614c48538ada879c91bf236d15f9a31ff70b98a6d037c8727ad407a92',
      'hex'
    )
    const result = await peer.eth!.getNodeData([key])

    t.ok(result.length === 1, 'handled GetNodeData')

    const hash = Buffer.from(
      'a321d27cd2743617c1c1b0d7ecb607dd14febcdfca8f01b79c3f0249505ea069',
      'hex'
    )
    t.ok(headers![1].hash().equals(hash), 'handled GetBlockHeaders')
    const bodies = await peer.eth!.getBlockBodies([hash])
    t.deepEquals(bodies, [[[], []]], 'handled GetBlockBodies')
    peer.eth!.send('NewBlockHashes', [[hash, new BN(2)]])
    t.pass('handled NewBlockHashes')
    await destroy(server, service)
    t.end()
  })

  t.test('should handle LES requests', async (t) => {
    const [server, service] = await setup()
    const peer = await server.accept('peer0')
    const { headers } = await peer.les!.getBlockHeaders({ block: new BN(1), max: 2 })
    t.equals(
      headers[1].hash().toString('hex'),
      'a321d27cd2743617c1c1b0d7ecb607dd14febcdfca8f01b79c3f0249505ea069',
      'handled GetBlockHeaders'
    )
    await destroy(server, service)
    t.end()
  })
})
