import { EventEmitter } from 'events'
import tape from 'tape-catch'
import td from 'testdouble'
import multiaddr from 'multiaddr'
import { Config } from '../../../lib/config'
import { Event } from '../../../lib/types'

tape('[RlpxServer]', async (t) => {
  class RlpxPeer extends EventEmitter {
    accept(_: any, _2: any) {}
    getId() {
      return Buffer.from([1])
    }
    getDisconnectPrefix(_: any) {
      return 'MockedReason'
    }
    static capabilities(_: any) {
      return []
    }
    _socket = { remoteAddress: 'mock', remotePort: 101 }
  }
  RlpxPeer.prototype.accept = td.func<any>()
  RlpxPeer.capabilities = td.func<any>()
  td.replace('../../../lib/net/peer/rlpxpeer', { RlpxPeer })

  class RLPx extends EventEmitter {
    listen(_: any, _2: any) {}
  }
  RLPx.prototype.listen = td.func<any>()
  class DPT extends EventEmitter {
    bind(_: any, _2: any) {}
    getDnsPeers() {}
  }
  DPT.prototype.bind = td.func<any>()
  DPT.prototype.getDnsPeers = td.func<any>()

  td.replace('@ethereumjs/devp2p', { DPT, RLPx })

  const { RlpxServer } = await import('../../../lib/net/server/rlpxserver')

  td.when(
    RlpxPeer.prototype.accept(td.matchers.anything(), td.matchers.isA(RlpxServer))
  ).thenResolve()

  t.test('should initialize correctly', async (t) => {
    const config = new Config({ transports: [] })
    const server = new RlpxServer({
      config,
      bootnodes: '10.0.0.1:1234,enode://abcd@10.0.0.2:1234',
      key: 'abcd',
    })
    t.equals(server.name, 'rlpx', 'get name')
    t.ok(server.key!.equals(Buffer.from('abcd', 'hex')), 'key parse')
    t.deepEquals(
      server.bootnodes,
      [multiaddr('/ip4/10.0.0.1/tcp/1234'), multiaddr('/ip4/10.0.0.2/tcp/1234')],
      'bootnodes split'
    )
    t.end()
  })

  t.test('should start/stop server', async (t) => {
    const config = new Config({ loglevel: 'error', transports: [] })
    const server = new RlpxServer({
      config,
      bootnodes: '10.0.0.1:1234,10.0.0.2:1234',
    })
    server.initDpt = td.func<typeof server['initDpt']>()
    server.initRlpx = td.func<typeof server['initRlpx']>()
    server.dpt = td.object()
    server.rlpx = td.object()
    td.when(
      server.dpt!.bootstrap({ address: '10.0.0.1', udpPort: 1234, tcpPort: 1234 })
    ).thenResolve()
    td.when(
      (server.dpt! as any).bootstrap({ address: '10.0.0.2', udpPort: '1234', tcpPort: '1234' })
    ).thenReject(new Error('err0'))
    server.config.events.on(Event.PEER_ERROR, (err: Error) =>
      t.equals(err.message, 'err0', 'got error')
    )
    await server.start()
    td.verify(server.initDpt())
    td.verify(server.initRlpx())
    t.ok(server.running, 'started')
    t.notOk(await server.start(), 'already started')
    await server.stop()
    td.verify(server.dpt!.destroy())
    td.verify(server.rlpx!.destroy())
    t.notOk(server.running, 'stopped')
    t.notOk(await server.stop(), 'already stopped')
    t.end()
  })

  t.test('should bootstrap with dns acquired peers', async (t) => {
    const dnsPeerInfo = { address: '10.0.0.5', udpPort: 1234, tcpPort: 1234 }
    const config = new Config({ loglevel: 'error', transports: [], discDns: true })
    const server = new RlpxServer({
      config,
      dnsNetworks: ['enrtree:A'],
    })
    server.initDpt = td.func<typeof server['initDpt']>()
    server.initRlpx = td.func<typeof server['initRlpx']>()
    server.rlpx = td.object()
    server.dpt = td.object<typeof server['dpt']>()
    td.when(server.dpt!.getDnsPeers()).thenResolve([dnsPeerInfo])
    await server.start()
    await server.bootstrap()
    td.verify(server.dpt!.bootstrap(dnsPeerInfo))
    await server.stop()
    t.end()
  })

  t.test('should return rlpx server info', async (t) => {
    const config = new Config({ loglevel: 'error', transports: [] })
    const mockId = '123'
    const server = new RlpxServer({
      config,
      bootnodes: '10.0.0.1:1234,10.0.0.2:1234',
    })
    server.initDpt = td.func<typeof server['initDpt']>()
    server.initRlpx = td.func<typeof server['initRlpx']>()
    server.dpt = td.object<typeof server['dpt']>()
    ;(server as any).rlpx = td.object({
      _id: mockId,
      destroy: td.func(),
    })
    td.when(
      server.dpt!.bootstrap({ address: '10.0.0.1', udpPort: 1234, tcpPort: 1234 })
    ).thenResolve(undefined)
    td.when(
      (server.dpt! as any).bootstrap({ address: '10.0.0.2', udpPort: '1234', tcpPort: '1234' })
    ).thenReject(new Error('err0'))
    config.events.on(Event.SERVER_ERROR, (err) => t.equals(err.message, 'err0', 'got error'))
    await server.start()
    const nodeInfo = server.getRlpxInfo()
    t.deepEqual(
      nodeInfo,
      {
        enode: `enode://${mockId}@[::]:30303`,
        id: mockId,
        ip: '::',
        listenAddr: '[::]:30303',
        ports: { discovery: 30303, listener: 30303 },
      },
      'get nodeInfo'
    )
    await server.stop()
    t.end()
  })

  t.test('should handle errors', (t) => {
    t.plan(3)
    let count = 0
    const config = new Config({ loglevel: 'error', transports: [] })
    const server = new RlpxServer({ config })
    server.config.events.on(Event.SERVER_ERROR, (err: Error) => {
      count = count + 1
      if (err.message === 'err0') t.pass('got server error - err0')
      if (err.message === 'err1') t.pass('got peer error - err1')
    })
    server.error(new Error('EPIPE'))
    server.error(new Error('err0'))
    setTimeout(() => {
      t.equals(count, 2, 'ignored error')
    }, 100)
    server.error(new Error('err1'))
  })

  t.test('should ban peer', (t) => {
    const config = new Config({ loglevel: 'error', transports: [] })
    const server = new RlpxServer({ config })
    t.notOk(server.ban('123'), 'not started')
    server.started = true
    server.dpt = td.object()
    server.ban('peer0', 1234)
    td.verify(server.dpt!.banPeer('peer0', 1234))
    t.end()
  })

  t.test('should init dpt', (t) => {
    t.plan(1)
    const config = new Config({ loglevel: 'error', transports: [] })
    const server = new RlpxServer({ config })
    server.initDpt().catch((error) => {
      throw error
    })
    td.verify((server.dpt as any).bind(server.config.port, '0.0.0.0'))
    config.events.on(Event.SERVER_ERROR, (err) => t.equals(err.message, 'err0', 'got error'))
    ;(server.dpt as any).emit('error', new Error('err0'))
  })

  t.test('should init rlpx', async (t) => {
    t.plan(4)
    const config = new Config({ loglevel: 'error', transports: [] })
    const server = new RlpxServer({ config })
    const rlpxPeer = new RlpxPeer()
    td.when(rlpxPeer.getId()).thenReturn(Buffer.from([1]))
    td.when(RlpxPeer.prototype.accept(rlpxPeer, td.matchers.isA(RlpxServer))).thenResolve()
    server.initRlpx().catch((error) => {
      throw error
    })
    td.verify(RlpxPeer.capabilities(Array.from((server as any).protocols)))
    td.verify(server.rlpx!.listen(server.config.port, '0.0.0.0'))
    config.events.on(Event.PEER_CONNECTED, (peer: any) =>
      t.ok(peer instanceof RlpxPeer, 'connected')
    )
    config.events.on(Event.PEER_DISCONNECTED, (peer: any) =>
      t.equals(peer.id, '01', 'disconnected')
    )
    config.events.on(Event.SERVER_ERROR, (err: Error) => t.equals(err.message, 'err0', 'got error'))
    config.events.on(Event.SERVER_LISTENING, (info: any) =>
      t.deepEquals(info, { transport: 'rlpx', url: 'enode://ff@[::]:30303' }, 'listening')
    )
    server.rlpx!.emit('peer:added', rlpxPeer)
    ;(server as any).peers.set('01', { id: '01' } as any)
    server.rlpx!.emit('peer:removed', rlpxPeer)
    server.rlpx!.emit('peer:error', rlpxPeer, new Error('err0'))
    server.rlpx!._id = Buffer.from('ff', 'hex')
    server.rlpx!.emit('listening')
  })

  t.test('should handles errors from id-less peers', async (t) => {
    t.plan(1)
    const config = new Config({ loglevel: 'error', transports: [] })
    const server = new RlpxServer({ config })
    const rlpxPeer = new RlpxPeer()
    td.when(rlpxPeer.getId()).thenReturn(Buffer.from('test'))
    td.when(RlpxPeer.prototype.accept(rlpxPeer, td.matchers.isA(RlpxServer))).thenResolve()
    server.initRlpx().catch((error) => {
      throw error
    })
    config.events.on(Event.SERVER_ERROR, (err) => t.equals(err.message, 'err0', 'got error'))
    server.rlpx!.emit('peer:error', rlpxPeer, new Error('err0'))
  })

  t.test('should reset td', (t) => {
    td.reset()
    t.end()
  })
})
