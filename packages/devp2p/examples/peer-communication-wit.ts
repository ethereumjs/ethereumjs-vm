import * as devp2p from '../src/index'
import { WIT, Peer, DISCONNECT_REASONS } from '../src/index'
import Common from '@ethereumjs/common'
import { bufferToHex } from 'ethereumjs-util'
import ms from 'ms'
import chalk from 'chalk'
import assert from 'assert'
import { randomBytes } from 'crypto'

const PRIVATE_KEY = randomBytes(32)

const common = new Common({ chain: 'rinkeby' })

const BLOCK_1M = {
  hash: Buffer.from('aa20f7bde5be60603f11a45fc4923aab7552be775403fc00c2e6b805e6297dbe', 'hex'),
}

const bootstrapNodes = common.bootstrapNodes()
const BOOTNODES = bootstrapNodes.map((node: any) => {
  return {
    address: node.ip,
    udpPort: node.port,
    tcpPort: node.port,
  }
})
const REMOTE_CLIENTID_FILTER = [
  'geth',
  'besu',
  'erigon',
  'openethereum',
  'quorum',
  'pirl',
  'ubiq',
  'gmc',
  'gwhale',
  'prichain',
]

const getPeerAddr = (peer: Peer) => `${peer._socket.remoteAddress}:${peer._socket.remotePort}`

// DPT
const dpt = new devp2p.DPT(PRIVATE_KEY, {
  refreshInterval: 30000,
  endpoint: {
    address: '0.0.0.0',
    udpPort: null,
    tcpPort: null,
  },
})

/* eslint-disable no-console */
dpt.on('error', (err) => console.error(chalk.red(`DPT error: ${err}`)))

/* eslint-disable @typescript-eslint/no-use-before-define */

// RLPx
const rlpx = new devp2p.RLPx(PRIVATE_KEY, {
  dpt,
  maxPeers: 25,
  capabilities: [devp2p.ETH.eth65, devp2p.WIT.wit0],
  common,
  remoteClientIdFilter: REMOTE_CLIENTID_FILTER,
})

rlpx.on('error', (err) => console.error(chalk.red(`RLPx error: ${err.stack || err}`)))

rlpx.on('peer:added', (peer) => {
  const addr = getPeerAddr(peer)

  console.log(
    'protocols: ',
    peer.getProtocols().map((p: any) => p._version)
  )
  const wit = peer.getProtocols().find((p: any) => p.constructor.name === 'WIT')

  if (!wit) {
    console.log(chalk.red('Peer does not support wit protocol, disconnecting'))
    peer.disconnect(DISCONNECT_REASONS.UNEXPECTED_IDENTITY)
    return
  }

  console.log(
    chalk.green(`Add peer: ${addr} (wit${wit.getVersion()}) (total: ${rlpx.getPeers().length})`)
  )

  wit.sendMessage(devp2p.WIT.MESSAGE_CODES.GET_BLOCK_WITNESS_HASHES, [0, BLOCK_1M.hash])

  wit.on('message', async (code: WIT.MESSAGE_CODES, payload: any) => {
    switch (code) {
      case devp2p.WIT.MESSAGE_CODES.BLOCK_WITNESS_HASHES: {
        console.log(
          `----------------------------------------------------------------------------------------------------------`
        )
        console.log(
          `witness received for ${bufferToHex(BLOCK_1M.hash)}: ${payload[1]
            .map((h: Buffer) => bufferToHex(h))
            .join(', ')} (from ${getPeerAddr(peer)})`
        )
        console.log(
          `----------------------------------------------------------------------------------------------------------`
        )

        break
      }

      case devp2p.WIT.MESSAGE_CODES.GET_BLOCK_WITNESS_HASHES: {
        // wit/0 spec notes:
        // * Nodes must always respond to the query.
        // * If the node does not have the requested block, it must return an empty reply.
        wit.sendMessage(WIT.MESSAGE_CODES.BLOCK_WITNESS_HASHES, [payload[0], []])
        break
      }
    }
  })
})

rlpx.on('peer:removed', (peer, reasonCode, disconnectWe) => {
  const who = disconnectWe ? 'we disconnect' : 'peer disconnect'
  const total = rlpx.getPeers().length
  console.log(
    chalk.yellow(
      `Remove peer: ${getPeerAddr(peer)} - ${who}, reason: ${peer.getDisconnectPrefix(
        reasonCode
      )} (${String(reasonCode)}) (total: ${total})`
    )
  )
})

rlpx.on('peer:error', (peer, err) => {
  if (err.code === 'ECONNRESET') return

  if (err instanceof assert.AssertionError) {
    const peerId = peer.getId()
    if (peerId !== null) dpt.banPeer(peerId, ms('5m'))

    console.error(chalk.red(`Peer error (${getPeerAddr(peer)}): ${err.message}`))
    return
  }

  console.error(chalk.red(`Peer error (${getPeerAddr(peer)}): ${err.stack || err}`))
})

// uncomment, if you want accept incoming connections
// rlpx.listen(30303, '0.0.0.0')
// dpt.bind(30303, '0.0.0.0')

for (const bootnode of BOOTNODES) {
  dpt.bootstrap(bootnode).catch((err) => {
    console.error(chalk.bold.red(`DPT bootstrap error: ${err.stack || err}`))
  })
}

// connect to local ethereum node (debug)
/*
dpt.addPeer({ address: '127.0.0.1', udpPort: 30303, tcpPort: 30303 })
  .then((peer) => {
    return rlpx.connect({
      id: peer.id,
      address: peer.address,
      tcpPort: peer.tcpPort,
      udpPort: peer.tcpPort
    })
  })
  .catch((err) => console.log(`error on connection to local node: ${err.stack || err}`)) */

setInterval(() => {
  const peersCount = dpt.getPeers().length
  const openSlots = rlpx._getOpenSlots()
  const queueLength = rlpx._peersQueue.length
  const queueLength2 = rlpx._peersQueue.filter((o) => o.ts <= Date.now()).length

  console.log(
    chalk.yellow(
      `Total nodes in DPT: ${peersCount}, open slots: ${openSlots}, queue: ${queueLength} / ${queueLength2}`
    )
  )
}, ms('30s'))
