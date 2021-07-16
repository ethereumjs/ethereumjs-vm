import tape from 'tape'
import { Event } from '../../lib/types'
import { wait, setup, destroy } from './util'

tape('[Integration:FullSync]', async (t) => {
  t.test('should sync blocks', async (t) => {
    const [remoteServer, remoteService] = await setup({ location: '127.0.0.2', height: 20 })
    const [localServer, localService] = await setup({ location: '127.0.0.1', height: 0 })
    await localService.synchronizer.stop()
    await localServer.discover('remotePeer1', '127.0.0.2')
    localService.config.events.on(Event.SYNC_SYNCHRONIZED, async () => {
      t.equals(localService.chain.blocks.height.toNumber(), 20, 'synced')
      await destroy(localServer, localService)
      await destroy(remoteServer, remoteService)
      t.end()
    })
    await localService.synchronizer.start()
  })

  t.test('should not sync with stale peers', async (t) => {
    const [remoteServer, remoteService] = await setup({ location: '127.0.0.2', height: 9 })
    const [localServer, localService] = await setup({ location: '127.0.0.1', height: 10 })
    localService.config.events.on(Event.SYNC_SYNCHRONIZED, async () => {
      t.fail('synced with a stale peer')
    })
    await localServer.discover('remotePeer', '127.0.0.2')
    await wait(300)
    await destroy(localServer, localService)
    await destroy(remoteServer, remoteService)
    t.pass('did not sync')
    t.end()
  })

  t.test('should sync with best peer', async (t) => {
    const [remoteServer1, remoteService1] = await setup({ location: '127.0.0.2', height: 9 })
    const [remoteServer2, remoteService2] = await setup({ location: '127.0.0.3', height: 10 })
    const [localServer, localService] = await setup({ location: '127.0.0.1', height: 0 })
    await localService.synchronizer.stop()
    await localServer.discover('remotePeer1', '127.0.0.2')
    await localServer.discover('remotePeer2', '127.0.0.3')
    localService.config.events.on(Event.SYNC_SYNCHRONIZED, async () => {
      if (localService.chain.blocks.height.toNumber() === 10) {
        t.pass('synced with best peer')
        await destroy(localServer, localService)
        await destroy(remoteServer1, remoteService1)
        await destroy(remoteServer2, remoteService2)
        t.end()
      }
    })
    await localService.synchronizer.start()
  })
})
