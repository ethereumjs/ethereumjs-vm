import tape from 'tape'
import td from 'testdouble'
import multiaddr from 'multiaddr'
import { Config } from '../../../lib/config'
import { Protocol } from '../../../lib/net/protocol'
import { Event } from '../../../lib/types'
import { Libp2pPeer } from '../../../lib/net/peer'

tape('[Libp2pPeer]', async (t) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const PeerId = td.replace('peer-id')

  const Libp2pNode = td.constructor(['start', 'stop', 'dial', 'dialProtocol'] as any)
  td.replace('../../../lib/net/peer/libp2pnode', { Libp2pNode })
  const Libp2pSender = td.replace('../../../lib/net/protocol/libp2psender')

  td.when(Libp2pNode.prototype.start()).thenResolve(null)
  td.when(Libp2pNode.prototype.dial(td.matchers.anything())).thenResolve(null)

  const { Libp2pPeer } = await import('../../../lib/net/peer/libp2ppeer')

  t.test('should initialize correctly', async (t) => {
    const config = new Config({ loglevel: 'error' })
    const multiaddrs = [
      multiaddr('/ip4/192.0.2.1/tcp/12345'),
      multiaddr('/ip4/192.0.2.1/tcp/23456'),
    ]
    const peer = new Libp2pPeer({ config, multiaddrs })
    t.equals(peer.address, '/ip4/192.0.2.1/tcp/12345,/ip4/192.0.2.1/tcp/23456', 'address correct')
    t.end()
  })

  t.test('should connect to peer', async (t) => {
    const config = new Config({ loglevel: 'error' })
    const peer = new Libp2pPeer({ config })
    config.events.on(Event.PEER_CONNECTED, (peer) => {
      t.equals((peer as Libp2pPeer).address, '/ip4/0.0.0.0/tcp/0', 'connected')
      t.end()
    })
    await peer.connect()
  })

  t.test('should accept peer connection', async (t) => {
    const config = new Config({ loglevel: 'error' })
    const peer: any = new Libp2pPeer({ config })
    peer.bindProtocol = td.func<typeof peer['bindProtocol']>()
    td.when(peer.bindProtocol('proto' as any, 'conn' as any)).thenResolve(null)
    await peer.accept('proto', 'conn', 'server')
    t.equals(peer.server, 'server', 'server set')
    t.ok(peer.inbound, 'inbound set to true')
    t.end()
  })

  t.test('should bind protocols', async (t) => {
    const config = new Config({ loglevel: 'error' })
    const protocol = { name: 'proto', versions: [1], open: () => {} } as Protocol
    const badProto = { name: 'bad', versions: [1], open: () => {} } as Protocol
    const peer: any = new Libp2pPeer({ config, protocols: [protocol, badProto] })
    const node = new Libp2pNode() as any
    peer.bindProtocol = td.func<typeof peer['bindProtocol']>()
    protocol.open = td.func<Protocol['open']>()
    badProto.open = td.func<Protocol['open']>()
    td.when(peer.bindProtocol(protocol, td.matchers.isA(Libp2pSender))).thenResolve(null)
    td.when(protocol.open()).thenResolve()
    td.when(node.dialProtocol(td.matchers.anything(), '/proto/1')).thenResolve(null)
    td.when(node.dialProtocol(td.matchers.anything(), '/bad/1')).thenReject(new Error('bad'))
    await peer.bindProtocols(node, td.matchers.anything(), 'server')
    t.equals(peer.server, 'server', 'server set')
    t.ok((peer as any).connected, 'connected set to true')
    t.end()
  })

  t.test('should reset td', (t) => {
    td.reset()
    t.end()
  })
})
