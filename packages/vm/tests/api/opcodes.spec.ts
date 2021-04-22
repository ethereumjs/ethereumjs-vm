import tape from 'tape'
import Common from '@ethereumjs/common'
import VM from '../../lib'

tape('VM -> getActiveOpcodes()', (t) => {
  const CHAINID = 0x46 //istanbul opcode
  const BEGINSUB = 0x5c // EIP-2315 opcode

  t.test('should not expose opcodes from a follow-up HF (istanbul -> petersburg)', async (st) => {
    const common = new Common({ chain: 'mainnet', hardfork: 'petersburg' })
    const vm = await VM.create({ common })
    st.equal(
      vm.getActiveOpcodes().get(CHAINID),
      undefined,
      'istanbul opcode not exposed (HF: < istanbul (petersburg)'
    )
    st.end()
  })

  t.test('should expose opcodes when HF is active (>= istanbul)', async (st) => {
    let common = new Common({ chain: 'mainnet', hardfork: 'istanbul' })
    let vm = await VM.create({ common })
    st.equal(
      vm.getActiveOpcodes().get(CHAINID)!.name,
      'CHAINID',
      'istanbul opcode exposed (HF: istanbul)'
    )

    common = new Common({ chain: 'mainnet', hardfork: 'muirGlacier' })
    vm = await VM.create({ common })
    st.equal(
      vm.getActiveOpcodes().get(CHAINID)!.name,
      'CHAINID',
      'istanbul opcode exposed (HF: > istanbul (muirGlacier)'
    )

    st.end()
  })

  t.test('should expose opcodes when EIP is active', async (st) => {
    let common = new Common({ chain: 'mainnet', hardfork: 'istanbul', eips: [2315] })
    let vm = await VM.create({ common })
    st.equal(
      vm.getActiveOpcodes().get(BEGINSUB)!.name,
      'BEGINSUB',
      'EIP-2315 opcode BEGINSUB exposed (EIP-2315 activated)'
    )

    common = new Common({ chain: 'mainnet', hardfork: 'istanbul' })
    vm = await VM.create({ common })
    st.equal(
      vm.getActiveOpcodes().get(BEGINSUB),
      undefined,
      'EIP-2315 opcode BEGINSUB not exposed (EIP-2315 not activated)'
    )

    st.end()
  })

  t.test('should update opcodes on a hardfork change', async (st) => {
    const common = new Common({ chain: 'mainnet', hardfork: 'istanbul' })
    const vm = await VM.create({ common })

    common.setHardfork('byzantium')
    st.equal(
      vm.getActiveOpcodes().get(CHAINID),
      undefined,
      'opcode not exposed after HF change (-> < istanbul)'
    )

    common.setHardfork('istanbul')
    st.equal(
      vm.getActiveOpcodes().get(CHAINID)!.name,
      'CHAINID',
      'opcode exposed after HF change (-> istanbul)'
    )

    st.end()
  })
})
