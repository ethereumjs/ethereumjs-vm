import { EventEmitter } from 'events'
import tape from 'tape-catch'
import td from 'testdouble'
import { BN } from '../../util/dist'
import { Config } from '../lib/config'
import { PeerPool } from '../lib/net/peerpool'
import { Event } from '../lib/types'

tape('[EthereumClient]', async (t) => {
  const config = new Config({ transports: [], loglevel: 'error' })
  class FullEthereumService extends EventEmitter {
    open() {}
    start() {}
    stop() {}
    config = config
    pool = new PeerPool({ config })
  }
  FullEthereumService.prototype.open = td.func<any>()
  FullEthereumService.prototype.start = td.func<any>()
  FullEthereumService.prototype.stop = td.func<any>()
  td.replace('../lib/service', { FullEthereumService })
  td.when(FullEthereumService.prototype.open()).thenResolve()
  td.when(FullEthereumService.prototype.start()).thenResolve()
  td.when(FullEthereumService.prototype.stop()).thenResolve()

  class Server extends EventEmitter {
    open() {}
    start() {}
    stop() {}
    bootstrap() {}
  }
  Server.prototype.open = td.func<any>()
  Server.prototype.start = td.func<any>()
  Server.prototype.stop = td.func<any>()
  Server.prototype.bootstrap = td.func<any>()
  td.replace('../lib/net/server/server', { Server })
  td.when(Server.prototype.start()).thenResolve()
  td.when(Server.prototype.stop()).thenResolve()
  td.when(Server.prototype.bootstrap()).thenResolve()

  const { default: EthereumClient } = await import('../lib/client')

  t.test('should initialize correctly', (t) => {
    const config = new Config({ transports: [], loglevel: 'error' })
    const client = new EthereumClient({ config })
    t.ok(client.services[0] instanceof FullEthereumService, 'added service')
    t.end()
  })

  t.test('should open', async (t) => {
    t.plan(2)
    const servers = [new Server()] as any
    const config = new Config({ servers })
    const client = new EthereumClient({ config })

    await client.open()
    t.ok(client.opened, 'opened')
    t.equals(await client.open(), false, 'already opened')
  })

  t.test('should set synchronized to true once synchronized is emitted', async (t) => {
    const servers = [new Server()] as any
    const config = new Config({ servers })
    const client = new EthereumClient({ config })

    t.equals(client.synchronized, false, 'not synchronized yet')
    await client.open()
    config.events.emit(Event.SYNC_SYNCHRONIZED, new BN(0))
    t.equals(client.synchronized, true, 'synchronized')
    t.end()
  })

  t.test('should start/stop', async (t) => {
    const servers = [new Server()] as any
    const config = new Config({ servers })
    const client = new EthereumClient({ config })
    await client.start()
    t.ok(client.started, 'started')
    t.equals(await client.start(), false, 'already started')
    await client.stop()
    t.notOk(client.started, 'stopped')
    t.equals(await client.stop(), false, 'already stopped')
    t.end()
  })

  t.test('should reset td', (t) => {
    td.reset()
    t.end()
  })
})
