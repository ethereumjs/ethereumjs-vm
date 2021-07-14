import tape from 'tape'
import { BN } from 'ethereumjs-util'
import { Config } from '../../lib/config'
import { FullEthereumService } from '../../lib/service'
import MockServer from './mocks/mockserver'
import MockChain from './mocks/mockchain'
import { destroy } from './util'
import Blockchain from '@ethereumjs/blockchain'

tape('[Integration:FullEthereumService]', async (t) => {
  async function setup(): Promise<[MockServer, FullEthereumService]> {
    const loglevel = 'error'
    const config = new Config({ loglevel, wit: true })
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
      wit: true,
    })
    const service = new FullEthereumService({
      config: serviceConfig,
      chain,
    })
    // Set syncing to false to skip VM execution
    service.synchronizer.execution.syncing = false
    await service.open()
    await service.start()
    await server.start()
    return [server, service]
  }

  t.test('should handle ETH requests', async (t) => {
    const [server, service] = await setup()
    const peer = await server.accept('peer0')
    const [reqId1, headers] = await peer.eth!.getBlockHeaders({ block: new BN(1), max: 2 })
    const hash = Buffer.from(
      '3221fd8d5bee00edfd88887805a8cfc5d95f0106e922e235ef0e4b6ce3ae8dc9',
      'hex'
    )
    t.ok(reqId1.eqn(1), 'handled GetBlockHeaders')
    t.ok(headers![1].hash().equals(hash), 'handled GetBlockHeaders')
    const [reqId2, bodies] = await peer.eth!.getBlockBodies({ hashes: [hash] })
    t.ok(reqId2.eqn(2), 'handled GetBlockBodies')
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
      '3221fd8d5bee00edfd88887805a8cfc5d95f0106e922e235ef0e4b6ce3ae8dc9',
      'handled GetBlockHeaders'
    )
    await destroy(server, service)
    t.end()
  })

  t.test('should handle WIT requests', async (t) => {
    const [server, service] = await setup()

    await service.synchronizer.execution.vm.runBlockchain(service.chain.blockchain)

    const peer = await server.accept('peer0')
    const block = await service.chain.getLatestBlock()
    const blockHash = block.hash()

    const [reqId, witnessHashes] = await peer.wit!.getBlockWitnessHashes({ blockHash })

    t.ok(witnessHashes.length > 0, 'handled GetBlockWitnessHashes')
    t.ok(reqId.eqn(1))
    await destroy(server, service)
    t.end()
  })
})
