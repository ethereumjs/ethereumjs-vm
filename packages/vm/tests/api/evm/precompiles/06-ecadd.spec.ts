import tape from 'tape'
import { Address, BN } from 'ethereumjs-util'
import Common from '@ethereumjs/common'
import VM from '../../../../lib'
import { getPrecompile } from '../../../../lib/evm/precompiles'

tape('Precompiles: ECADD', (t) => {
  t.test('ECADD', async (st) => {
    const common = new Common({ chain: 'mainnet', hardfork: 'petersburg' })
    const vm = await VM.create({ common: common })
    const address = new Address(Buffer.from('0000000000000000000000000000000000000006', 'hex'))
    const ECADD = getPrecompile(address, common)

    const result = await ECADD({
      data: Buffer.alloc(0),
      gasLimit: new BN(0xffff),
      _common: common,
      _VM: vm,
    })

    st.deepEqual(result.gasUsed.toNumber(), 500, 'should use petersburg gas costs')
    st.end()
  })
})
