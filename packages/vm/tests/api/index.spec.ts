import tape from 'tape'
import { KECCAK256_RLP } from 'ethereumjs-util'
import { SecureTrie as Trie } from 'merkle-patricia-tree'
import Common from '@ethereumjs/common'
import { DefaultStateManager } from '../../lib/state'
import VM from '../../lib'
import { isRunningInKarma } from '../util'
import { setupVM } from './utils'
import testnet from './testdata/testnet.json'
import testnet2 from './testdata/testnet2.json'

// explicitly import util and buffer,
// needed for karma-typescript bundling
// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
import * as util from 'util'
// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
import { Buffer } from 'buffer'

/**
 * Tests for the main constructor API and
 * exposed functionality by lib/index.js
 *
 * The following re-exported VM methods are tested within
 * their own files:
 *
 * runBlockchain.spec.ts
 * runBlock.spec.ts
 * runTx.spec.ts
 * runCall.spec.ts
 * runCode.spec.ts
 *
 * opcodes.spec.ts (getActiveOpcodes())
 */

tape('VM -> basic instantiation / boolean switches', (t) => {
  t.test('should instantiate without params', async (st) => {
    const vm = await VM.create()
    st.ok(vm.stateManager)
    st.deepEqual(
      (vm.stateManager as DefaultStateManager)._trie.root,
      KECCAK256_RLP,
      'it has default trie'
    )
    st.equal(vm._common.hardfork(), 'istanbul', 'it has correct default HF')
    st.end()
  })

  t.test('should be able to activate precompiles', async (st) => {
    const vm = await VM.create({ activatePrecompiles: true })
    st.notDeepEqual(
      (vm.stateManager as DefaultStateManager)._trie.root,
      KECCAK256_RLP,
      'it has different root'
    )
    st.end()
  })

  t.test('should instantiate with async constructor', async (st) => {
    const vm = await VM.create({ activatePrecompiles: true })
    st.notDeepEqual(
      (vm.stateManager as DefaultStateManager)._trie.root,
      KECCAK256_RLP,
      'it has different root'
    )
    st.end()
  })
})

tape('VM -> common (chain, HFs, EIPs)', (t) => {
  t.test('should accept a common object as option', async (st) => {
    const common = new Common({ chain: 'mainnet', hardfork: 'istanbul' })

    const vm = await VM.create({ common })
    st.equal(vm._common, common)

    st.end()
  })

  t.test('should only accept valid chain and fork', async (st) => {
    let common = new Common({ chain: 'ropsten', hardfork: 'byzantium' })
    let vm = await VM.create({ common })
    st.equal((vm.stateManager as DefaultStateManager)._common.param('gasPrices', 'ecAdd'), 500)

    try {
      common = new Common({ chain: 'mainchain', hardfork: 'homestead' })
      vm = await VM.create({ common })
      st.fail('should have failed for invalid chain')
    } catch (e) {
      st.ok(e.message.includes('not supported'))
    }

    st.end()
  })

  t.test('should accept a supported EIP', async (st) => {
    if (isRunningInKarma()) {
      st.skip('BLS does not work in karma')
      return st.end()
    }
    const common = new Common({ chain: 'mainnet', eips: [2537] })
    st.doesNotThrow(async () => {
      await VM.create({ common })
    })
    st.end()
  })

  t.test(
    'should accept a custom chain config (Common.forCustomChain() static constructor)',
    async (st) => {
      const customChainParams = { name: 'custom', chainId: 123, networkId: 678 }
      const common = Common.forCustomChain('mainnet', customChainParams, 'byzantium')

      const vm = await VM.create({ common })
      st.equal(vm._common, common)
      st.end()
    }
  )

  t.test(
    'should accept a custom chain config (Common customChains constructor option)',
    async (st) => {
      const customChains = [testnet, testnet2]
      const common = new Common({ chain: 'testnet2', hardfork: 'berlin', customChains })

      const vm = await VM.create({ common })
      st.equal(vm._common, common)
      st.end()
    }
  )
})

tape('VM -> state (deprecated), blockchain', (t) => {
  t.test('should work with trie (state) provided', async (st) => {
    const trie = new Trie()
    const vm = await VM.create({ state: trie, activatePrecompiles: true })
    st.notDeepEqual(
      (vm.stateManager as DefaultStateManager)._trie.root,
      KECCAK256_RLP,
      'it has different root'
    )
    st.end()
  })

  t.test('should instantiate', async (st) => {
    const vm = await setupVM()
    st.deepEqual(
      (vm.stateManager as DefaultStateManager)._trie.root,
      KECCAK256_RLP,
      'it has default trie'
    )
    st.end()
  })

  t.test('should pass the correct Common object when copying the VM', async (st) => {
    const vm = await setupVM({ common: new Common({ chain: 'ropsten', hardfork: 'byzantium' }) })

    st.equal(vm._common.chainName(), 'ropsten')
    st.equal(vm._common.hardfork(), 'byzantium')

    const copiedVM = vm.copy()
    st.equal(copiedVM._common.chainName(), 'ropsten')
    st.equal(copiedVM._common.hardfork(), 'byzantium')

    st.end()
  })
})
