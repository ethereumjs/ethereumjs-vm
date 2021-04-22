import tape from 'tape'
import { Address, BN } from 'ethereumjs-util'
import Common from '@ethereumjs/common'
import VM from '../../../lib'
import { ERROR } from '../../../lib/exceptions'
import { createAccount } from '../utils'

const testCases = [
  { original: new BN(0), code: '60006000556000600055', used: 1612, refund: 0 }, // 0 -> 0 -> 0
  { original: new BN(0), code: '60006000556001600055', used: 20812, refund: 0 }, // 0 -> 0 -> 1
  { original: new BN(0), code: '60016000556000600055', used: 20812, refund: 19200 }, // 0 -> 1 -> 0
  { original: new BN(0), code: '60016000556002600055', used: 20812, refund: 0 }, // 0 -> 1 -> 2
  { original: new BN(0), code: '60016000556001600055', used: 20812, refund: 0 }, // 0 -> 1 -> 1
  { original: new BN(1), code: '60006000556000600055', used: 5812, refund: 15000 }, // 1 -> 0 -> 0
  { original: new BN(1), code: '60006000556001600055', used: 5812, refund: 4200 }, // 1 -> 0 -> 1
  { original: new BN(1), code: '60006000556002600055', used: 5812, refund: 0 }, // 1 -> 0 -> 2
  { original: new BN(1), code: '60026000556000600055', used: 5812, refund: 15000 }, // 1 -> 2 -> 0
  { original: new BN(1), code: '60026000556003600055', used: 5812, refund: 0 }, // 1 -> 2 -> 3
  { original: new BN(1), code: '60026000556001600055', used: 5812, refund: 4200 }, // 1 -> 2 -> 1
  { original: new BN(1), code: '60026000556002600055', used: 5812, refund: 0 }, // 1 -> 2 -> 2
  { original: new BN(1), code: '60016000556000600055', used: 5812, refund: 15000 }, // 1 -> 1 -> 0
  { original: new BN(1), code: '60016000556002600055', used: 5812, refund: 0 }, // 1 -> 1 -> 2
  { original: new BN(1), code: '60016000556001600055', used: 1612, refund: 0 }, // 1 -> 1 -> 1
  { original: new BN(0), code: '600160005560006000556001600055', used: 40818, refund: 19200 }, // 0 -> 1 -> 0 -> 1
  { original: new BN(1), code: '600060005560016000556000600055', used: 10818, refund: 19200 }, // 1 -> 0 -> 1 -> 0
  {
    original: new BN(1),
    gas: new BN(2306),
    code: '6001600055',
    used: 2306,
    refund: 0,
    err: ERROR.OUT_OF_GAS,
  }, // 1 -> 1 (2300 sentry + 2xPUSH)
  { original: new BN(1), gas: new BN(2307), code: '6001600055', used: 806, refund: 0 }, // 1 -> 1 (2301 sentry + 2xPUSH)
]

tape('Istanbul: EIP-2200', async (t) => {
  t.test('net-metering SSTORE', async (st) => {
    const caller = new Address(Buffer.from('0000000000000000000000000000000000000000', 'hex'))
    const addr = new Address(Buffer.from('00000000000000000000000000000000000000ff', 'hex'))
    const key = new BN(0).toArrayLike(Buffer, 'be', 32)
    for (const testCase of testCases) {
      const common = new Common({ chain: 'mainnet', hardfork: 'istanbul' })
      const vm = await VM.create({ common })

      const account = createAccount(new BN(0), new BN(0))
      await vm.stateManager.putAccount(addr, account)
      await vm.stateManager.putContractCode(addr, Buffer.from(testCase.code, 'hex'))
      if (!testCase.original.isZero()) {
        await vm.stateManager.putContractStorage(addr, key, testCase.original.toArrayLike(Buffer))
      }

      const runCallArgs = {
        caller,
        gasLimit: testCase.gas ? testCase.gas : new BN(0xffffffffff),
        to: addr,
      }

      try {
        const res = await vm.runCall(runCallArgs)
        if (testCase.err) {
          st.equal(res.execResult.exceptionError?.error, testCase.err)
        } else {
          st.assert(res.execResult.exceptionError === undefined)
        }
        st.assert(new BN(testCase.used).eq(res.gasUsed))
        st.assert(new BN(testCase.refund).eq(res.execResult.gasRefund!))
      } catch (e) {
        st.fail(e.message)
      }
    }

    st.end()
  })
})
