import tape from 'tape-catch'
import td from 'testdouble'
import { Config } from '../../../lib/config'
import { Fetcher } from '../../../lib/sync/fetcher/fetcher'
import { Job } from '../../../lib/sync/fetcher/types'
import { Event } from '../../../lib/types'

class FetcherTest extends Fetcher<any, any, any> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  process(_job: any, res: any) {
    return undefined // have to return undefined, otherwise the function return signature is void.
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async request(_job: any, peer: any) {
    return
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async store(store: any) {}
}

tape('[Fetcher]', (t) => {
  t.test('should handle bad result', (t) => {
    t.plan(2)
    const config = new Config({ loglevel: 'error', transports: [] })
    const fetcher = new FetcherTest({ config, pool: td.object() })
    const job: any = { peer: {}, state: 'active' }
    ;(fetcher as any).running = true
    fetcher.next = td.func<FetcherTest['next']>()
    fetcher.wait = td.func<FetcherTest['wait']>()
    td.when(fetcher.wait()).thenResolve(undefined)
    fetcher.success(job, undefined)
    t.equals((fetcher as any).in.size(), 1, 'enqueued job')
    setTimeout(() => t.ok(job.peer.idle, 'peer idled'), 10)
  })

  t.test('should handle failure', (t) => {
    t.plan(2)
    const config = new Config({ loglevel: 'error', transports: [] })
    const fetcher = new FetcherTest({ config, pool: td.object() })
    const job = { peer: {}, state: 'active' }
    ;(fetcher as any).running = true
    fetcher.next = td.func<FetcherTest['next']>()
    config.events.on(Event.SYNC_FETCHER_ERROR, (err: Error) =>
      t.equals(err.message, 'err0', 'got error')
    )
    fetcher.failure(job as Job<any, any, any>, new Error('err0'))
    t.equals((fetcher as any).in.size(), 1, 'enqueued job')
  })

  t.test('should handle expiration', (t) => {
    t.plan(2)
    const config = new Config({ loglevel: 'error', transports: [] })
    const fetcher = new FetcherTest({
      config,
      pool: td.object(),
      timeout: 5,
    })
    const job = { index: 0 }
    const peer = { idle: true }
    fetcher.peer = td.func<FetcherTest['peer']>()
    fetcher.request = td.func<FetcherTest['request']>()
    td.when(fetcher.peer()).thenReturn(peer)
    td.when(fetcher.request(td.matchers.anything(), { idle: false }), { delay: 10 }).thenReject(
      new Error('err0')
    )
    td.when((fetcher as any).pool.contains({ idle: false })).thenReturn(true)
    ;(fetcher as any).in.insert(job)
    ;(fetcher as any)._readableState = []
    ;(fetcher as any).running = true
    ;(fetcher as any).total = 10
    fetcher.next()
    setTimeout(() => {
      t.deepEquals(job, { index: 0, peer: { idle: false }, state: 'expired' }, 'expired job')
      t.equals((fetcher as any).in.size(), 1, 'enqueued job')
    }, 20)
  })

  t.test('should reset td', (t) => {
    td.reset()
    t.end()
  })
})
