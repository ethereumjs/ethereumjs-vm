import { EventEmitter } from 'events'
import tape from 'tape-catch'
import td from 'testdouble'
import { Peer } from '../../../lib/net/peer'
import { Config } from '../../../lib/config'
import { Event } from '../../../lib/types'

tape('[Peer]', (t) => {
  const config = new Config({ transports: [], loglevel: 'error' })
  const peer = new Peer({
    config,
    id: '0123456789abcdef',
    address: 'address0',
    transport: 'transport0',
    inbound: true,
  })

  t.test('should get/set idle state', (t) => {
    t.ok(peer.idle, 'is initially idle')
    peer.idle = false
    t.notOk(peer.idle, 'idle set to false')
    t.end()
  })

  t.test('should bind protocol', async (t) => {
    const bound = new EventEmitter() as any
    const sender = 'sender' as any
    const protocol = td.object('Protocol') as any
    bound.name = 'bound0'
    protocol.name = 'proto0'

    t.plan(3)
    td.when(protocol.bind(peer, sender)).thenResolve(bound)
    await peer.bindProtocol(protocol, sender)
    t.equals(peer.bound.get('bound0'), bound, 'protocol bound')
    config.events.on(Event.PROTOCOL_MESSAGE, (msg: string, name: string, msgPeer: Peer) => {
      t.ok(msg === 'msg0' && name === 'proto0' && msgPeer === peer, 'on message')
    })
    config.events.on(Event.PEER_ERROR, (err) => {
      if (err.message === 'err0') t.pass('on error')
    })
    config.events.emit(Event.PROTOCOL_MESSAGE, 'msg0', 'proto0', peer)
    config.events.emit(Event.PEER_ERROR, new Error('err0'), peer)
  })

  t.test('should understand protocols', (t) => {
    t.ok(peer.understands('bound0'), 'understands bound protocol')
    t.notOk(peer.understands('unknown'), 'does not understand unknown protocol')
    t.end()
  })

  t.test('should convert to string', (t) => {
    t.equals(
      peer.toString(true),
      'id=0123456789abcdef address=address0 transport=transport0 protocols=bound0 inbound=true',
      'correct full id string'
    )
    peer.inbound = false
    t.equals(
      peer.toString(),
      'id=01234567 address=address0 transport=transport0 protocols=bound0 inbound=false',
      'correct short id string'
    )
    t.end()
  })
})
