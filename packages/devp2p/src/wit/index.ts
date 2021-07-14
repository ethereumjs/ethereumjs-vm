import { EventEmitter } from 'events'
import * as rlp from 'rlp'
import { debug as createDebugLogger } from 'debug'
import { formatLogData } from '../util'
import { Peer } from '../rlpx/peer'

const debug = createDebugLogger('devp2p:wit')
const verbose = createDebugLogger('verbose').enabled

export class WIT extends EventEmitter {
  _version: any
  _peer: Peer
  _send: any

  constructor(version: number, peer: Peer, send: any) {
    super()

    this._version = version
    this._peer = peer
    this._send = send
  }

  static wit0 = { name: 'eth', version: 0, length: 8, constructor: WIT }

  _handleMessage(code: WIT.MESSAGE_CODES, data: any) {
    const payload = rlp.decode(data)

    const debugMsg = `Received ${this.getMsgPrefix(code)} message from
        ${this._peer._socket.remoteAddress}:${this._peer._socket.remotePort}`
    const logData = formatLogData(data.toString('hex'), verbose)
    debug(`${debugMsg}: ${logData}`)

    switch (code) {
      case WIT.MESSAGE_CODES.GET_BLOCK_WITNESS_HASHES:
        break
      case WIT.MESSAGE_CODES.BLOCK_WITNESS_HASHES:
        break
      default:
        return
    }

    this.emit('message', code, payload)
  }

  getVersion() {
    return this._version
  }

  /**
   *
   * @param code Message code
   * @param payload Payload (including reqId, e.g. `[1, [437000, 1, 0, 0]]`)
   */
  sendMessage(code: WIT.MESSAGE_CODES, payload: any) {
    const debugMsg = `Send ${this.getMsgPrefix(code)} message to ${
      this._peer._socket.remoteAddress
    }:${this._peer._socket.remotePort}`
    const logData = formatLogData(rlp.encode(payload).toString('hex'), verbose)
    debug(`${debugMsg}: ${logData}`)

    switch (code) {
      case WIT.MESSAGE_CODES.GET_BLOCK_WITNESS_HASHES:
        break
      case WIT.MESSAGE_CODES.BLOCK_WITNESS_HASHES:
        break
      default:
        throw new Error(`Unknown code ${code}`)
    }

    this._send(code, rlp.encode(payload))
  }

  getMsgPrefix(msgCode: WIT.MESSAGE_CODES) {
    return WIT.MESSAGE_CODES[msgCode]
  }
}

export namespace WIT {
  export enum MESSAGE_CODES {
    GET_BLOCK_WITNESS_HASHES = 0x01,
    BLOCK_WITNESS_HASHES = 0x02,
  }
}
