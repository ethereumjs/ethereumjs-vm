import tape from 'tape'
import { Address, BN } from 'ethereumjs-util'
import Common from '@ethereumjs/common'
import VM from '../../../lib'
import { getPrecompile } from '../../../lib/evm/precompiles'

tape('Istanbul: EIP-1108 tests', (t) => {
  t.test('ECADD', async (st) => {
    const common = new Common({ chain: 'mainnet', hardfork: 'istanbul' })
    const vm = await VM.create({ common })
    const address = new Address(Buffer.from('0000000000000000000000000000000000000006', 'hex'))
    const ECADD = getPrecompile(address, common)

    const result = await ECADD({
      data: Buffer.alloc(0),
      gasLimit: new BN(0xffff),
      _common: common,
      _VM: vm,
    })

    st.deepEqual(result.gasUsed.toNumber(), 150, 'should use istanbul gas costs')
    st.end()
  })

  t.test('ECMUL', async (st) => {
    const common = new Common({ chain: 'mainnet', hardfork: 'istanbul' })
    const vm = await VM.create({ common })
    const address = new Address(Buffer.from('0000000000000000000000000000000000000007', 'hex'))
    const ECMUL = getPrecompile(address, common)

    const result = await ECMUL({
      data: Buffer.alloc(0),
      gasLimit: new BN(0xffff),
      _common: common,
      _VM: vm,
    })

    st.deepEqual(result.gasUsed.toNumber(), 6000, 'should use istanbul gas costs')
    st.end()
  })

  t.test('ECPAIRING', async (st) => {
    const common = new Common({ chain: 'mainnet', hardfork: 'istanbul' })
    const vm = await VM.create({ common })
    const address = new Address(Buffer.from('0000000000000000000000000000000000000008', 'hex'))
    const ECPAIRING = getPrecompile(address, common)

    const result = await ECPAIRING({
      data: Buffer.from(
        '00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000002198e9393920d483a7260bfb731fb5d25f1aa493335a9e71297e485b7aef312c21800deef121f1e76426a00665e5c4479674322d4f75edadd46debd5cd992f6ed090689d0585ff075ec9e99ad690c3395bc4b313370b38ef355acdadcd122975b12c85ea5db8c6deb4aab71808dcb408fe3d1e7690c43d37b4ce6cc0166fa7daa000000000000000000000000000000000000000000000000000000000000000130644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd45198e9393920d483a7260bfb731fb5d25f1aa493335a9e71297e485b7aef312c21800deef121f1e76426a00665e5c4479674322d4f75edadd46debd5cd992f6ed090689d0585ff075ec9e99ad690c3395bc4b313370b38ef355acdadcd122975b12c85ea5db8c6deb4aab71808dcb408fe3d1e7690c43d37b4ce6cc0166fa7daa',
        'hex'
      ),
      gasLimit: new BN(0xffffff),
      _common: common,
      _VM: vm,
    })

    st.deepEqual(
      result.gasUsed.toNumber(),
      113000,
      'should use petersburg gas costs (k ^= 2 pairings)'
    )
    st.end()
  })
})
