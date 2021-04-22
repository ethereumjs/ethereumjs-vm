import tape from 'tape'
import { Server as RPCServer, HttpServer } from 'jayson/promise'
import VM from '@ethereumjs/vm'
import Common from '@ethereumjs/common'
import { RPCManager as Manager } from '../../lib/rpc'
import { getLogger } from '../../lib/logging'
import { Config } from '../../lib/config'
import { Chain } from '../../lib/blockchain/chain'
import { RlpxServer } from '../../lib/net/server/rlpxserver'
import { mockBlockchain } from './mockBlockchain'
import type Blockchain from '@ethereumjs/blockchain'
import type EthereumClient from '../../lib/client'
const request = require('supertest')

const config: any = { loglevel: 'error' }
config.logger = getLogger(config)

export function startRPC(methods: any, port: number = 3000) {
  const server = new RPCServer(methods)
  const httpServer = server.http()
  httpServer.listen(port)
  return httpServer
}

export function closeRPC(server: HttpServer) {
  server.close()
}

export function createManager(client: EthereumClient) {
  return new Manager(client, config)
}

export function createClient(clientOpts: any = {}) {
  const common = clientOpts.commonChain ?? new Common({ chain: 'mainnet' })
  const config = new Config({ transports: [], common })
  const blockchain = clientOpts.blockchain ?? ((<any>mockBlockchain()) as Blockchain)

  const chain = new Chain({ config, blockchain })
  chain.opened = true

  const defaultClientConfig = {
    blockchain: chain,
    opened: true,
    ethProtocolVersions: [63],
  }
  const clientConfig = { ...defaultClientConfig, ...clientOpts }

  const servers = [
    new RlpxServer({
      config,
      bootnodes: '10.0.0.1:1234,10.0.0.2:1234',
    }),
  ]

  let synchronizer
  if (clientOpts.includeVM) {
    synchronizer = { execution: { vm: new (VM as any)({ blockchain, common }) } }
  }

  const client: any = {
    services: [
      {
        name: 'eth',
        chain: clientConfig.blockchain,
        pool: { peers: [1, 2, 3] },
        protocols: [
          {
            name: 'eth',
            versions: clientConfig.ethProtocolVersions,
          },
        ],
        synchronizer,
      },
    ],
    servers,
    opened: clientConfig.opened,
    server: (name: string) => {
      return servers.find((s) => s.name === name)
    },
  }

  return client as EthereumClient
}

export function baseSetup() {
  const manager = createManager(createClient())
  const server = startRPC(manager.getMethods())
  return server
}

export function params(method: string, params: Array<any> = []) {
  const req = {
    jsonrpc: '2.0',
    method,
    params,
    id: 1,
  }
  return req
}

export function baseRequest(
  t: tape.Test,
  server: HttpServer,
  req: Object,
  expect: number,
  expectRes: Function
) {
  request(server)
    .post('/')
    .set('Content-Type', 'application/json')
    .send(req)
    .expect(expect)
    .expect(expectRes)
    .end((err?: Error) => {
      closeRPC(server)
      t.end(err)
    })
}
