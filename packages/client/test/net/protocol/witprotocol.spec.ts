import tape from 'tape-catch'
import { Chain } from '../../../lib/blockchain'
import { Config } from '../../../lib/config'
import { WitProtocol } from '../../../lib/net/protocol'

tape('[WitProtocol]', (t) => {
  t.test('should get properties', (t) => {
    const config = new Config({ transports: [], loglevel: 'error' })
    const chain = new Chain({ config })
    const p = new WitProtocol({ config, chain })
    t.ok(typeof p.name === 'string', 'get name')
    t.ok(Array.isArray(p.versions), 'get versions')
    t.ok(Array.isArray(p.messages), 'get messages')
    t.end()
  })

  t.test('should open correctly', async (t) => {
    const config = new Config({ transports: [], loglevel: 'error' })
    const chain = new Chain({ config })
    const p = new WitProtocol({ config, chain })
    await p.open()
    t.ok(p.opened, 'opened is true')
    t.notOk(await p.open(), 'repeat open')
    t.end()
  })
})
