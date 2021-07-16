import { EventEmitter } from 'events'
import tape from 'tape-catch'
import td from 'testdouble'
import { BN } from '../../../util/dist'
import { Config } from '../../lib/config'
import { Event } from '../../lib/types'

tape('[LightEthereumService]', async (t) => {
  class PeerPool extends EventEmitter {
    open() {}
    close() {}
  }
  PeerPool.prototype.open = td.func<any>()
  PeerPool.prototype.close = td.func<any>()
  td.replace('../../lib/net/peerpool', { PeerPool })
  const Chain = td.constructor([] as any)
  Chain.prototype.open = td.func()
  td.replace('../../lib/blockchain', { Chain })
  const LesProtocol = td.constructor([] as any)
  td.replace('../../lib/net/protocol/lesprotocol', { LesProtocol })
  class LightSynchronizer extends EventEmitter {
    start() {}
    stop() {}
    open() {}
  }
  LightSynchronizer.prototype.start = td.func<any>()
  LightSynchronizer.prototype.stop = td.func<any>()
  LightSynchronizer.prototype.open = td.func<any>()
  td.replace('../../lib/sync/lightsync', { LightSynchronizer })

  const { LightEthereumService } = await import('../../lib/service/lightethereumservice')

  t.test('should initialize correctly', async (t) => {
    const config = new Config({ transports: [], loglevel: 'error' })
    const service = new LightEthereumService({ config })
    t.ok(service.synchronizer instanceof LightSynchronizer, 'light sync')
    t.equals(service.name, 'eth', 'got name')
    t.end()
  })

  t.test('should get protocols', async (t) => {
    const config = new Config({ transports: [], loglevel: 'error' })
    const service = new LightEthereumService({ config })
    t.ok(service.protocols[0] instanceof LesProtocol, 'light protocols')
    t.end()
  })

  t.test('should open', async (t) => {
    t.plan(3)
    const server = td.object() as any
    const config = new Config({ servers: [server], loglevel: 'error' })
    const service = new LightEthereumService({ config })
    await service.open()
    td.verify(service.chain.open())
    td.verify(service.synchronizer.open())
    td.verify(server.addProtocols(td.matchers.anything()))
    service.config.events.on(Event.SYNC_SYNCHRONIZED, () => t.pass('synchronized'))
    service.config.events.on(Event.SYNC_ERROR, (err: Error) => {
      if (err.message === 'error0') t.pass('got error 1')
    })
    service.config.events.emit(Event.SYNC_SYNCHRONIZED, new BN(0))
    service.config.events.emit(Event.SYNC_ERROR, new Error('error0'))
    service.config.events.on(Event.SERVER_ERROR, (err: Error) => {
      if (err.message === 'error1') t.pass('got error 2')
    })
    service.config.events.emit(Event.SERVER_ERROR, new Error('error1'), server)
    await service.stop()
  })

  t.test('should start/stop', async (t) => {
    const server = td.object() as any
    const config = new Config({ servers: [server], loglevel: 'error' })
    const service = new LightEthereumService({ config })
    await service.start()
    td.verify(service.synchronizer.start())
    t.notOk(await service.start(), 'already started')
    await service.stop()
    td.verify(service.synchronizer.stop())
    t.notOk(await service.stop(), 'already stopped')
    t.end()
  })

  t.test('should reset td', (t) => {
    td.reset()
    t.end()
  })
})
