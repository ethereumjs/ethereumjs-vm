import tape from 'tape'
import { Config } from '../../lib/config'
import { EthProtocol } from '../../lib/net/protocol'
import { PeerPool } from '../../lib/net/peerpool'
import MockServer from './mocks/mockserver'
import MockChain from './mocks/mockchain'
import Blockchain from '@ethereumjs/blockchain'
import { Event } from '../../lib/types'

tape('[Integration:PeerPool]', async (t) => {
  async function setup(protocols: EthProtocol[] = []): Promise<[MockServer, PeerPool]> {
    const serverConfig = new Config({ loglevel: 'error' })
    const server = new MockServer({ config: serverConfig }) as any
    server.addProtocols(protocols)
    const config = new Config({ servers: [server] })
    await server.start()
    const pool = new PeerPool({ config })
    await pool.open()
    return [server, pool]
  }

  async function destroy(server: MockServer, pool: PeerPool) {
    await server.stop()
    await pool.close()
  }

  t.test('should open', async (t) => {
    const [server, pool] = await setup()
    t.ok((pool as any).opened, 'opened')
    await destroy(server, pool)
    t.end()
  })

  t.test('should add/remove peer', async (t) => {
    const [server, pool] = await setup()
    pool.config.events.on(Event.POOL_PEER_ADDED, (peer: any) =>
      t.equal(peer.id, 'peer0', 'added peer')
    )
    pool.config.events.on(Event.POOL_PEER_REMOVED, (peer: any) =>
      t.equal(peer.id, 'peer0', 'removed peer')
    )
    pool.add(await server.accept('peer0'))
    setTimeout(async () => {
      server.disconnect('peer0')
      await destroy(server, pool)
      t.pass('destroyed')
      t.end()
    }, 100)
  })

  t.test('should ban peer', async (t) => {
    const [server, pool] = await setup()
    pool.config.events.on(Event.POOL_PEER_ADDED, (peer: any) =>
      t.equal(peer.id, 'peer0', 'added peer')
    )
    pool.config.events.on(Event.POOL_PEER_BANNED, (peer: any) =>
      t.equal(peer.id, 'peer0', 'banned peer')
    )
    pool.add(await server.accept('peer0'))
    setTimeout(async () => {
      pool.ban(pool.peers[0])
      await destroy(server, pool)
      t.pass('destroyed')
      t.end()
    }, 100)
  })

  t.test('should handle peer messages', async (t) => {
    const config = new Config({ transports: [], loglevel: 'error' })
    const blockchain = new Blockchain({
      validateBlocks: false,
      validateConsensus: false,
    })
    const chain = new MockChain({ config, blockchain })
    await chain.open()
    const protocols = [
      new EthProtocol({
        config,
        chain,
      }),
    ]
    const [server, pool] = await setup(protocols)
    config.events.on(Event.POOL_PEER_ADDED, (peer: any) => t.equal(peer.id, 'peer0', 'added peer'))
    config.events.on(Event.PROTOCOL_MESSAGE, (msg: any, proto: any, peer: any) => {
      t.deepEqual([msg, proto, peer.id], ['msg0', 'proto0', 'peer0'], 'got message')
    })
    pool.add(await server.accept('peer0'))
    setTimeout(async () => {
      config.events.emit(Event.PROTOCOL_MESSAGE, 'msg0', 'proto0', pool.peers[0])
      await destroy(server, pool)
      t.pass('destroyed')
      t.end()
    }, 100)
  })
})
