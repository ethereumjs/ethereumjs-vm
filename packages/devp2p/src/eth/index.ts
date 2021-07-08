import assert from 'assert'
import { EventEmitter } from 'events'
import * as rlp from 'rlp'
import ms from 'ms'
import { BN } from 'ethereumjs-util'
import { int2buffer, buffer2int, assertEq, formatLogId, formatLogData } from '../util'
import { Peer, DISCONNECT_REASONS } from '../rlpx/peer'

import { debug as createDebugLogger } from 'debug'
const debug = createDebugLogger('devp2p:eth')
const verbose = createDebugLogger('verbose').enabled

type SendMethod = (code: ETH.MESSAGE_CODES, data: Buffer) => any

export class ETH extends EventEmitter {
  _version: number
  _peer: Peer
  _status: ETH.StatusMsg | null
  _peerStatus: ETH.StatusMsg | null
  _statusTimeoutId: NodeJS.Timeout
  _send: SendMethod

  // Eth64
  _hardfork: string = 'chainstart'
  _latestBlock = new BN(0)
  _forkHash: string = ''
  _nextForkBlock = new BN(0)

  constructor(version: number, peer: Peer, send: SendMethod) {
    super()

    this._version = version
    this._peer = peer
    this._send = send

    this._status = null
    this._peerStatus = null
    this._statusTimeoutId = setTimeout(() => {
      this._peer.disconnect(DISCONNECT_REASONS.TIMEOUT)
    }, ms('5s'))

    // Set forkHash and nextForkBlock
    if (this._version >= 64) {
      const c = this._peer._common
      this._hardfork = c.hardfork() ? c.hardfork() : this._hardfork
      // Set latestBlock minimally to start block of fork to have some more
      // accurate basis if no latestBlock is provided along status send
      this._latestBlock = c.hardforkBlockBN(this._hardfork) ?? new BN(0)
      this._forkHash = c.forkHash(this._hardfork)
      // Next fork block number or 0 if none available
      this._nextForkBlock = c.nextHardforkBlockBN(this._hardfork) ?? new BN(0)
    }
  }

  static eth62 = { name: 'eth', version: 62, length: 8, constructor: ETH }
  static eth63 = { name: 'eth', version: 63, length: 17, constructor: ETH }
  static eth64 = { name: 'eth', version: 64, length: 29, constructor: ETH }
  static eth65 = { name: 'eth', version: 65, length: 29, constructor: ETH }

  _handleMessage(code: ETH.MESSAGE_CODES, data: any) {
    const payload = rlp.decode(data) as unknown
    if (code !== ETH.MESSAGE_CODES.STATUS) {
      const debugMsg = `Received ${this.getMsgPrefix(code)} message from ${
        this._peer._socket.remoteAddress
      }:${this._peer._socket.remotePort}`
      const logData = formatLogData(data.toString('hex'), verbose)
      debug(`${debugMsg}: ${logData}`)
    }
    switch (code) {
      case ETH.MESSAGE_CODES.STATUS:
        assertEq(this._peerStatus, null, 'Uncontrolled status message', debug)
        this._peerStatus = payload as ETH.StatusMsg
        debug(
          `Received ${this.getMsgPrefix(code)} message from ${this._peer._socket.remoteAddress}:${
            this._peer._socket.remotePort
          }: : ${this._peerStatus ? this._getStatusString(this._peerStatus) : ''}`
        )
        this._handleStatus()
        break

      case ETH.MESSAGE_CODES.NEW_BLOCK_HASHES:
      case ETH.MESSAGE_CODES.TX:
      case ETH.MESSAGE_CODES.GET_BLOCK_HEADERS:
      case ETH.MESSAGE_CODES.BLOCK_HEADERS:
      case ETH.MESSAGE_CODES.GET_BLOCK_BODIES:
      case ETH.MESSAGE_CODES.BLOCK_BODIES:
      case ETH.MESSAGE_CODES.NEW_BLOCK:
        if (this._version >= ETH.eth62.version) break
        return

      case ETH.MESSAGE_CODES.GET_NODE_DATA:
      case ETH.MESSAGE_CODES.NODE_DATA:
      case ETH.MESSAGE_CODES.GET_RECEIPTS:
      case ETH.MESSAGE_CODES.RECEIPTS:
        if (this._version >= ETH.eth63.version) break
        return

      case ETH.MESSAGE_CODES.NEW_POOLED_TRANSACTION_HASHES:
      case ETH.MESSAGE_CODES.GET_POOLED_TRANSACTIONS:
      case ETH.MESSAGE_CODES.POOLED_TRANSACTIONS:
        if (this._version >= ETH.eth65.version) break
        return

      default:
        return
    }

    this.emit('message', code, payload)
  }

  /**
   * Eth 64 Fork ID validation (EIP-2124)
   * @param forkId Remote fork ID
   */
  _validateForkId(forkId: Buffer[]) {
    const c = this._peer._common

    const peerForkHash = `0x${forkId[0].toString('hex')}`
    const peerNextFork = new BN(forkId[1])

    if (this._forkHash === peerForkHash) {
      // There is a known next fork
      if (!peerNextFork.isZero()) {
        if (this._latestBlock.gte(peerNextFork)) {
          const msg = 'Remote is advertising a future fork that passed locally'
          debug(msg)
          throw new assert.AssertionError({ message: msg })
        }
      }
    }
    const peerFork: any = c.hardforkForForkHash(peerForkHash)
    if (peerFork === null) {
      const msg = 'Unknown fork hash'
      debug(msg)
      throw new assert.AssertionError({ message: msg })
    }

    if (!c.hardforkGteHardfork(peerFork.name, this._hardfork)) {
      const nextHardforkBlock = c.nextHardforkBlockBN(peerFork.name)
      if (peerNextFork === null || !nextHardforkBlock || !nextHardforkBlock.eq(peerNextFork)) {
        const msg = 'Outdated fork status, remote needs software update'
        debug(msg)
        throw new assert.AssertionError({ message: msg })
      }
    }
  }

  _handleStatus(): void {
    if (this._status === null || this._peerStatus === null) return
    clearTimeout(this._statusTimeoutId)

    assertEq(this._status[0], this._peerStatus[0], 'Protocol version mismatch', debug)
    assertEq(this._status[1], this._peerStatus[1], 'NetworkId mismatch', debug)
    assertEq(this._status[4], this._peerStatus[4], 'Genesis block mismatch', debug)

    const status: any = {
      networkId: this._peerStatus[1],
      td: Buffer.from(this._peerStatus[2]),
      bestHash: Buffer.from(this._peerStatus[3]),
      genesisHash: Buffer.from(this._peerStatus[4]),
    }

    if (this._version >= 64) {
      assertEq(this._peerStatus[5].length, 2, 'Incorrect forkId msg format', debug)
      this._validateForkId(this._peerStatus[5] as Buffer[])
      status['forkId'] = this._peerStatus[5]
    }

    this.emit('status', status)
  }

  getVersion() {
    return this._version
  }

  _forkHashFromForkId(forkId: Buffer): string {
    return `0x${forkId.toString('hex')}`
  }

  _nextForkFromForkId(forkId: Buffer): number {
    return buffer2int(forkId)
  }

  _getStatusString(status: ETH.StatusMsg) {
    let sStr = `[V:${buffer2int(status[0] as Buffer)}, NID:${buffer2int(
      status[1] as Buffer
    )}, TD:${buffer2int(status[2] as Buffer)}`
    sStr += `, BestH:${formatLogId(status[3].toString('hex'), verbose)}, GenH:${formatLogId(
      status[4].toString('hex'),
      verbose
    )}`
    if (this._version >= 64) {
      sStr += `, ForkHash: ${status[5] ? '0x' + (status[5][0] as Buffer).toString('hex') : '-'}`
      sStr += `, ForkNext: ${status[5] ? buffer2int(status[5][1] as Buffer) : '-'}`
    }
    sStr += `]`
    return sStr
  }

  sendStatus(status: ETH.StatusOpts) {
    if (this._status !== null) return
    this._status = [
      int2buffer(this._version),
      this._peer._common.chainIdBN().toArrayLike(Buffer),
      status.td,
      status.bestHash,
      status.genesisHash,
    ]
    if (this._version >= 64) {
      if (status.latestBlock) {
        const latestBlock = new BN(status.latestBlock)
        if (latestBlock.lt(this._latestBlock)) {
          throw new Error(
            'latest block provided is not matching the HF setting of the Common instance (Rlpx)'
          )
        }
        this._latestBlock = latestBlock
      }
      const forkHashB = Buffer.from(this._forkHash.substr(2), 'hex')
      const nextForkB = this._nextForkBlock.eqn(0)
        ? Buffer.from('', 'hex')
        : this._nextForkBlock.toArrayLike(Buffer)

      this._status.push([forkHashB, nextForkB])
    }

    debug(
      `Send STATUS message to ${this._peer._socket.remoteAddress}:${
        this._peer._socket.remotePort
      } (eth${this._version}): ${this._getStatusString(this._status)}`
    )
    this._send(ETH.MESSAGE_CODES.STATUS, rlp.encode(this._status as any))
    this._handleStatus()
  }

  sendMessage(code: ETH.MESSAGE_CODES, payload: any) {
    const debugMsg = `Send ${this.getMsgPrefix(code)} message to ${
      this._peer._socket.remoteAddress
    }:${this._peer._socket.remotePort}`
    const logData = formatLogData(rlp.encode(payload).toString('hex'), verbose)
    debug(`${debugMsg}: ${logData}`)

    switch (code) {
      case ETH.MESSAGE_CODES.STATUS:
        throw new Error('Please send status message through .sendStatus')

      case ETH.MESSAGE_CODES.NEW_BLOCK_HASHES:
      case ETH.MESSAGE_CODES.TX:
      case ETH.MESSAGE_CODES.GET_BLOCK_HEADERS:
      case ETH.MESSAGE_CODES.BLOCK_HEADERS:
      case ETH.MESSAGE_CODES.GET_BLOCK_BODIES:
      case ETH.MESSAGE_CODES.BLOCK_BODIES:
      case ETH.MESSAGE_CODES.NEW_BLOCK:
        if (this._version >= ETH.eth62.version) break
        throw new Error(`Code ${code} not allowed with version ${this._version}`)

      case ETH.MESSAGE_CODES.GET_NODE_DATA:
      case ETH.MESSAGE_CODES.NODE_DATA:
      case ETH.MESSAGE_CODES.GET_RECEIPTS:
      case ETH.MESSAGE_CODES.RECEIPTS:
        if (this._version >= ETH.eth63.version) break
        throw new Error(`Code ${code} not allowed with version ${this._version}`)

      case ETH.MESSAGE_CODES.NEW_POOLED_TRANSACTION_HASHES:
      case ETH.MESSAGE_CODES.GET_POOLED_TRANSACTIONS:
      case ETH.MESSAGE_CODES.POOLED_TRANSACTIONS:
        if (this._version >= ETH.eth65.version) break
        throw new Error(`Code ${code} not allowed with version ${this._version}`)

      default:
        throw new Error(`Unknown code ${code}`)
    }

    this._send(code, rlp.encode(payload))
  }

  getMsgPrefix(msgCode: ETH.MESSAGE_CODES): string {
    return ETH.MESSAGE_CODES[msgCode]
  }
}

export namespace ETH {
  export interface StatusMsg extends Array<Buffer | Buffer[]> {}

  export type StatusOpts = {
    td: Buffer
    bestHash: Buffer
    latestBlock?: number
    genesisHash: Buffer
  }

  export enum MESSAGE_CODES {
    // eth62
    STATUS = 0x00,
    NEW_BLOCK_HASHES = 0x01,
    TX = 0x02,
    GET_BLOCK_HEADERS = 0x03,
    BLOCK_HEADERS = 0x04,
    GET_BLOCK_BODIES = 0x05,
    BLOCK_BODIES = 0x06,
    NEW_BLOCK = 0x07,

    // eth63
    GET_NODE_DATA = 0x0d,
    NODE_DATA = 0x0e,
    GET_RECEIPTS = 0x0f,
    RECEIPTS = 0x10,

    // eth65
    NEW_POOLED_TRANSACTION_HASHES = 0x08,
    GET_POOLED_TRANSACTIONS = 0x09,
    POOLED_TRANSACTIONS = 0x0a,
  }
}
