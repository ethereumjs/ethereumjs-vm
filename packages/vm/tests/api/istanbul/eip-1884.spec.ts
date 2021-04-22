import tape from 'tape'
import { Address, BN } from 'ethereumjs-util'
import Common from '@ethereumjs/common'
import VM from '../../../lib'
import { ERROR } from '../../../lib/exceptions'
import { createAccount } from '../utils'

const testCases = [
  { chain: 'mainnet', hardfork: 'istanbul', selfbalance: '0xf1' },
  { chain: 'mainnet', hardfork: 'constantinople', err: ERROR.INVALID_OPCODE },
]

// SELFBALANCE PUSH8 0x00 MSTORE8 PUSH8 0x01 PUSH8 0x00 RETURN
const code = ['47', '60', '00', '53', '60', '01', '60', '00', 'f3']
tape('Istanbul: EIP-1884', async (t) => {
  t.test('SELFBALANCE', async (st) => {
    const addr = new Address(Buffer.from('00000000000000000000000000000000000000ff', 'hex'))
    const runCodeArgs = {
      code: Buffer.from(code.join(''), 'hex'),
      gasLimit: new BN(0xffff),
      address: addr,
    }

    for (const testCase of testCases) {
      const { chain, hardfork } = testCase
      const common = new Common({ chain, hardfork })
      const vm = await VM.create({ common })

      const balance = testCase.selfbalance
        ? new BN(Buffer.from(testCase.selfbalance.slice(2), 'hex'))
        : undefined
      const account = createAccount(new BN(0), balance)

      await vm.stateManager.putAccount(addr, account)

      try {
        const res = await vm.runCode(runCodeArgs)
        if (testCase.err) {
          st.equal(res.exceptionError?.error, testCase.err)
        } else {
          st.assert(res.exceptionError === undefined)
          st.assert(
            new BN(Buffer.from(testCase.selfbalance.slice(2), 'hex')).eq(new BN(res.returnValue))
          )
        }
      } catch (e) {
        st.fail(e.message)
      }
    }

    st.end()
  })
})
