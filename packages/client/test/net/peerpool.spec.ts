import tape from 'tape-catch'
import td from 'testdouble'
import { EventEmitter } from 'events'
import { Config } from '../../lib/config'
import { RlpxServer } from '../../lib/net/server'
import { Event } from '../../lib/types'
import MockPeer from '../integration/mocks/mockpeer'

tape('[PeerPool]', async (t) => {
  const Peer = td.replace('../../lib/net/peer/peer', function (this: any, id: string) {
    this.id = id // eslint-disable-line no-invalid-this
  })
  const { PeerPool } = await import('../../lib/net/peerpool')

  t.test('should initialize', (t) => {
    const config = new Config({ transports: [] })
    const pool = new PeerPool({ config })
    t.notOk((pool as any).pool.size, 'empty pool')
    t.notOk((pool as any).opened, 'not open')
    t.end()
  })

  t.test('should open/close', async (t) => {
    t.plan(3)
    const server = new EventEmitter()
    const config = new Config({ servers: [server as RlpxServer] })
    const pool = new PeerPool({ config })
    const peer = new MockPeer({
      id: 'peer',
      location: 'abc',
      config: config,
      address: '0.0.0.0',
      transport: 'udp',
    })
    await pool.open()
    config.events.on(Event.PEER_CONNECTED, (peer: any) => {
      if (pool.contains(peer.id)) t.pass('peer connected')
    })
    config.events.on(Event.POOL_PEER_REMOVED, () => {
      if (!pool.contains('peer')) t.pass('peer disconnected')
    })
    pool.add(peer)
    pool.remove(peer)
    t.equals(await pool.open(), false, 'already opened')
    await pool.close()
    t.notOk((pool as any).opened, 'closed')
    t.end()
  })

  t.test('should connect/disconnect peer', (t) => {
    t.plan(2)
    const peer = new EventEmitter() as any
    const config = new Config({ loglevel: 'error', transports: [] })
    const pool = new PeerPool({ config })
    ;(peer as any).id = 'abc'
    ;(peer as any).handleMessageQueue = td.func()
    pool.connected(peer)
    pool.config.events.on(Event.PROTOCOL_MESSAGE, (msg: any, proto: any, p: any) => {
      t.ok(msg === 'msg0' && proto === 'proto0' && p === peer, 'got message')
    })
    config.events.emit(Event.PROTOCOL_MESSAGE, 'msg0', 'proto0', peer)
    pool.config.events.emit(Event.PEER_ERROR, new Error('err0'), peer)
    pool.disconnected(peer)
    t.notOk((pool as any).pool.get('abc'), 'peer removed')
  })

  t.test('should check contains', (t) => {
    const peer = new Peer('abc')
    const config = new Config({ transports: [], loglevel: 'error' })
    const pool = new PeerPool({ config })
    pool.add(peer)
    t.ok(pool.contains(peer.id), 'found peer')
    t.end()
  })

  t.test('should get idle peers', (t) => {
    const peers = [new Peer(1), new Peer(2), new Peer(3)]
    const config = new Config({ transports: [] })
    const pool = new PeerPool({ config })
    peers[1].idle = true
    peers.forEach((p) => pool.add(p))
    t.equals(pool.idle(), peers[1], 'correct idle peer')
    t.equals(
      pool.idle((p: any) => p.id > 1),
      peers[1],
      'correct idle peer with filter'
    )
    t.end()
  })

  t.test('should ban peer', (t) => {
    const peers = [{ id: 1 }, { id: 2, server: { ban: td.func() } }]
    const config = new Config({ transports: [] })
    const pool = new PeerPool({ config })
    peers.forEach((p: any) => pool.add(p))
    peers.forEach((p: any) => pool.ban(p, 1000))
    pool.config.events.on(Event.POOL_PEER_BANNED, (peer: any) =>
      t.equals(peer, peers[1], 'banned peer')
    )
    pool.config.events.on(Event.POOL_PEER_REMOVED, (peer: any) =>
      t.equals(peer, peers[1], 'removed peer')
    )
    t.equals(pool.peers[0], peers[0], 'outbound peer not banned')
    t.end()
  })

  t.test('should reset td', (t) => {
    td.reset()
    t.end()
  })
})
