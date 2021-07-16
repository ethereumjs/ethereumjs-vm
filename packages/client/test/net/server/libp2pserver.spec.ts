import { EventEmitter } from 'events'
import tape from 'tape-catch'
import td from 'testdouble'
import multiaddr from 'multiaddr'
import { Config } from '../../../lib/config'
import { Event } from '../../../lib/types'

tape('[Libp2pServer]', async (t) => {
  const Libp2pPeer = td.replace('../../../lib/net/peer/libp2ppeer')
  Libp2pPeer.id = 'id0'

  class Libp2pNode extends EventEmitter {
    handle(_: any, _2: Function) {}
    start() {}
    stop() {}
    multiaddrs = ['ma0']
    connectionManager = new EventEmitter()
    addressManager = { getListenAddrs: () => ['ma0'] }
  }
  Libp2pNode.prototype.handle = td.func<any>()
  Libp2pNode.prototype.start = td.func<any>()
  Libp2pNode.prototype.stop = td.func<any>()
  td.replace('../../../lib/net/peer/libp2pnode', { Libp2pNode })

  const conn0 = 'conn0' as any
  const conn1 = 'conn1' as any
  td.when(Libp2pNode.prototype.handle('/proto/1', td.callback)).thenCallback(
    { connection: conn0 },
    null
  )
  td.when(Libp2pNode.prototype.handle('/proto/2', td.callback)).thenCallback(
    { connection: conn1 },
    null
  )
  td.when(Libp2pNode.prototype.start()).thenResolve()
  td.when(Libp2pNode.prototype.stop()).thenResolve()

  const { Libp2pServer } = await import('../../../lib/net/server/libp2pserver')

  t.test('should initialize correctly', async (t) => {
    const config = new Config({ transports: [] })
    const multiaddrs = [
      multiaddr('/ip4/192.0.2.1/tcp/12345'),
      multiaddr('/ip4/192.0.2.1/tcp/23456'),
    ]
    const server = new Libp2pServer({
      config,
      multiaddrs,
      bootnodes: ['0.0.0.0:3030', '1.1.1.1:3031'],
      key: Buffer.from('abcd'),
    })
    t.deepEquals((server as any).multiaddrs, multiaddrs, 'multiaddrs correct')
    t.deepEquals(
      server.bootnodes,
      [multiaddr('/ip4/0.0.0.0/tcp/3030'), multiaddr('/ip4/1.1.1.1/tcp/3031')],
      'bootnodes split'
    )
    t.equals(server.key!.toString(), 'abcd', 'key is correct')
    t.equals(server.name, 'libp2p', 'get name')
    t.end()
  })

  t.test('should get peer info', async (t) => {
    const config = new Config({ transports: [] })
    const server = new Libp2pServer({ config })
    const connection = td.object<any>()
    connection.remotePeer = 'id0'
    t.equals(server.getPeerInfo(connection)[0], 'id0', 'got id')
    t.end()
  })

  t.test('should create peer', async (t) => {
    const config = new Config({ transports: [] })
    const multiaddrs = [multiaddr('/ip4/6.6.6.6')]
    const server = new Libp2pServer({ config, multiaddrs })
    const peerId = {
      toB58String() {
        return 'id'
      },
    } as any
    const peer = server.createPeer(peerId, [])
    t.equals(peer.constructor.name, 'Libp2pPeer', 'created peer')
    t.equals((server as any).peers.get(peer.id), peer, 'has peer')
    t.end()
  })

  t.test('should start/stop server and test banning', async (t) => {
    t.plan(11)
    const config = new Config({ transports: [], loglevel: 'off' })
    const multiaddrs = [multiaddr('/ip4/6.6.6.6')]
    const server = new Libp2pServer({ config, multiaddrs, key: Buffer.from('4') })
    const protos: any = [
      { name: 'proto', versions: [1] },
      { name: 'proto', versions: [2] },
    ]
    const peer = td.object<any>()
    const peer2 = td.object({ id: 'id2', bindProtocols: td.func() }) as any
    protos.forEach((p: any) => {
      p.open = td.func()
      td.when(p.open()).thenResolve(null)
    })
    server.createPeer = td.func<typeof server['createPeer']>()
    server.getPeerInfo = td.func<typeof server['getPeerInfo']>()
    server.getPeerId = td.func<typeof server['getPeerId']>()
    const peerId = {
      toB58String() {
        return 'id'
      },
    } as any
    const peerId2 = {
      toB58String() {
        return 'id2'
      },
    } as any
    const peerId3 = {
      toB58String() {
        return 'id3'
      },
    } as any
    td.when(server.getPeerId()).thenResolve(peerId)
    td.when(server.getPeerInfo(conn0)).thenReturn([peerId])
    td.when(server.getPeerInfo(conn1)).thenReturn([peerId2])
    td.when(server.createPeer(peerId2)).thenReturn(peer2)
    td.when(peer.accept(protos[0], 'conn0', server)).thenResolve(null)
    ;(server as any).peers.set('id', peer)
    server.addProtocols(protos)
    config.events.on(Event.SERVER_LISTENING, (info: any) =>
      t.deepEquals(info, { transport: 'libp2p', url: 'ma0/p2p/id' }, 'listening')
    )
    config.events.once(Event.PEER_CONNECTED, (p: any) => t.equals(p, peer, 'peer connected'))
    config.events.on(Event.SERVER_ERROR, (err) => t.equals(err.message, 'err0', 'got err0'))
    t.notOk(server.ban('peer'), 'unbannable')
    t.notOk(await server.stop(), 'not started')
    await server.start()
    ;(server as any).node.emit('error', new Error('err0'))
    t.notOk(server.addProtocols([]), 'cannot add protocols after start')
    server.ban('peer0', 10)
    t.ok(server.isBanned('peer0'), 'banned')
    setTimeout(() => {
      t.notOk(server.isBanned('peer0'), 'ban expired')
    }, 20)
    const { node } = server as any
    t.equals(node.constructor.name, 'Libp2pNode', 'libp2p node created')
    node.emit('peer:discovery', peerId)
    td.when(peer2.bindProtocols(node, 'id2', server)).thenResolve(null)
    server.config.events.once(Event.PEER_CONNECTED, () => t.ok('peer2 connected'))
    node.emit('peer:discovery', peerId2)
    td.when(server.getPeerInfo('conn3' as any)).thenReturn([peerId3, 'ma1' as any])
    node.connectionManager.emit('peer:connect', 'conn3')
    td.verify(server.createPeer(peerId3, ['ma1'] as any))
    await server.stop()
    t.notOk(server.running, 'stopped')
  })

  t.test('should reset td', (t) => {
    td.reset()
    t.end()
  })
})
