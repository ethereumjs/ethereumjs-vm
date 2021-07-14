import test from 'tape'
import * as devp2p from '../../src'
import * as util from './util'

const capabilities = [devp2p.WIT.wit0]

// FIXME: Handle unhandled promises directly
process.on('unhandledRejection', () => {})

test('WIT: send GetBlockWitnessHashes (0x01)', async (t) => {
  const opts: any = {}
  opts.onOnceStatus0 = function (rlpxs: any, wit: any) {
    t.equal(wit.getVersion(), 0, 'should use wit0 as protocol version')
    const blockHash = Buffer.from(
      'a321d27cd2743617c1c1b0d7ecb607dd14febcdfca8f01b79c3f0249505ea069',
      'hex'
    )
    wit.sendMessage(devp2p.WIT.MESSAGE_CODES.GET_BLOCK_WITNESS_HASHES, [1, blockHash])
    t.pass('should send GET_BLOCK_WITNESS_HASHES message')
  }
  opts.onOnMsg1 = function (rlpxs: any, wit: any, code: any) {
    if (code === devp2p.WIT.MESSAGE_CODES.GET_BLOCK_WITNESS_HASHES) {
      t.pass('should receive GET_BLOCK_WITNESS_HASHES message')
      util.destroyRLPXs(rlpxs)
      t.end()
    }
  }
  util.twoPeerMsgExchange(t, opts, capabilities)
})

test('WIT: send BlockWitnessHashes (0x02)', async (t) => {
  const opts: any = {}
  opts.onOnceStatus0 = function (rlpxs: any, wit: any) {
    t.equal(wit.getVersion(), 0, 'should use wit0 as protocol version')
    const witnessHashes = [
      Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex'),
      Buffer.from('0000000000000000000000000000000000000000000000000000000000000002', 'hex'),
    ]
    wit.sendMessage(devp2p.WIT.MESSAGE_CODES.BLOCK_WITNESS_HASHES, [1, witnessHashes])
    t.pass('should send BLOCK_WITNESS_HASHES message')
  }
  opts.onOnMsg1 = function (rlpxs: any, wit: any, code: any) {
    if (code === devp2p.WIT.MESSAGE_CODES.BLOCK_WITNESS_HASHES) {
      t.pass('should receive BLOCK_WITNESS_HASHES message')
      util.destroyRLPXs(rlpxs)
      t.end()
    }
  }
  util.twoPeerMsgExchange(t, opts, capabilities)
})

test('WIT: send unknown message code', async (t) => {
  const opts: any = {}
  opts.onOnceStatus0 = function (rlpxs: any, wit: any) {
    try {
      wit.sendMessage(0x55, [1, []])
    } catch (err) {
      const msg = 'Error: Unknown code 85'
      t.equal(err.toString(), msg, `should emit error: ${msg}`)
      util.destroyRLPXs(rlpxs)
      t.end()
    }
  }
  util.twoPeerMsgExchange(t, opts, capabilities)
})
