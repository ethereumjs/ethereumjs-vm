import tape from 'tape'
import { Address, BN, rlp, KECCAK256_RLP, Account } from 'ethereumjs-util'
import Common from '@ethereumjs/common'
import { Block } from '@ethereumjs/block'
import {
  AccessListEIP2930Transaction,
  Transaction,
  TypedTransaction,
  FeeMarketEIP1559Transaction,
  Capability,
} from '@ethereumjs/tx'
import { RunBlockOpts, AfterBlockEvent } from '../../src/runBlock'
import type { PreByzantiumTxReceipt, PostByzantiumTxReceipt } from '../../src/types'
import { setupPreConditions, getDAOCommon } from '../util'
import { setupVM, createAccount } from './utils'
import testnet from './testdata/testnet.json'
import VM from '../../src/index'
import { setBalance } from './utils'

const testData = require('./testdata/blockchain.json')
const common = new Common({ chain: 'mainnet', hardfork: 'berlin' })

tape('runBlock() -> successful API parameter usage', async (t) => {
  async function simpleRun(vm: VM) {
    const genesisRlp = testData.genesisRLP
    const genesis = Block.fromRLPSerializedBlock(genesisRlp)

    const blockRlp = testData.blocks[0].rlp
    const block = Block.fromRLPSerializedBlock(blockRlp)

    //@ts-ignore
    await setupPreConditions(vm.stateManager._trie, testData)

    t.ok(
      //@ts-ignore
      vm.stateManager._trie.root.equals(genesis.header.stateRoot),
      'genesis state root should match calculated state root'
    )

    const res = await vm.runBlock({
      block,
      // @ts-ignore
      root: vm.stateManager._trie.root,
      skipBlockValidation: true,
    })

    t.equal(
      res.results[0].gasUsed.toString('hex'),
      '5208',
      'actual gas used should equal blockHeader gasUsed'
    )
  }

  async function uncleRun(vm: VM) {
    const testData = require('./testdata/uncleData.json')

    //@ts-ignore
    await setupPreConditions(vm.stateManager._trie, testData)

    const block1Rlp = testData.blocks[0].rlp
    const block1 = Block.fromRLPSerializedBlock(block1Rlp)
    await vm.runBlock({
      block: block1,
      // @ts-ignore
      root: vm.stateManager._trie.root,
      skipBlockValidation: true,
    })

    const block2Rlp = testData.blocks[1].rlp
    const block2 = Block.fromRLPSerializedBlock(block2Rlp)
    await vm.runBlock({
      block: block2,
      // @ts-ignore
      root: vm.stateManager._trie.root,
      skipBlockValidation: true,
    })

    const block3Rlp = testData.blocks[2].rlp
    const block3 = Block.fromRLPSerializedBlock(block3Rlp)
    await vm.runBlock({
      block: block3,
      // @ts-ignore
      root: vm.stateManager._trie.root,
      skipBlockValidation: true,
    })

    const uncleReward = (
      await vm.stateManager.getAccount(
        Address.fromString('0xb94f5374fce5ed0000000097c15331677e6ebf0b')
      )
    ).balance.toString('hex')

    t.equals(
      `0x${uncleReward}`,
      testData.postState['0xb94f5374fce5ed0000000097c15331677e6ebf0b'].balance,
      'calculated balance should equal postState balance'
    )
  }

  t.test('PoW block, unmodified options', async (t) => {
    const vm = setupVM()
    await simpleRun(vm)
    t.end()
  })

  t.test('Uncle blocks, compute uncle rewards', async (t) => {
    const vm = setupVM()
    await uncleRun(vm)
    t.end()
  })

  t.test(
    'PoW block, Common custom chain (Common.forCustomChain() static constructor)',
    async (t) => {
      const customChainParams = { name: 'custom', chainId: 123, networkId: 678 }
      const common = Common.forCustomChain('mainnet', customChainParams, 'berlin')
      const vm = setupVM({ common })
      await simpleRun(vm)
      t.end()
    }
  )

  t.test('PoW block, Common custom chain (Common customChains constructor option)', async (t) => {
    const customChains = [testnet]
    const common = new Common({ chain: 'testnet', hardfork: 'berlin', customChains })
    const vm = setupVM({ common })
    await simpleRun(vm)
    t.end()
  })

  t.test('hardforkByBlockNumber option', async (t) => {
    const common1 = new Common({
      chain: 'mainnet',
      hardfork: 'muirGlacier',
    })

    // Have to use an unique common, otherwise the HF will be set to muirGlacier and then will not change back to chainstart.
    const common2 = new Common({
      chain: 'mainnet',
      hardfork: 'chainstart',
    })

    const privateKey = Buffer.from(
      'e331b6d69882b4cb4ea581d88e0b604039a3de5967688d3dcffdd2270c0fd109',
      'hex'
    )

    function getBlock(common: Common): Block {
      return Block.fromBlockData(
        {
          header: {
            number: new BN(10000000),
          },
          transactions: [
            Transaction.fromTxData(
              {
                data: '0x600154', // PUSH 01 SLOAD
                gasLimit: new BN(100000),
              },
              { common }
            ).sign(privateKey),
          ],
        },
        { common }
      )
    }

    const vm = new VM({ common: common1, hardforkByBlockNumber: true })
    const vm_noSelect = new VM({ common: common2 })

    const txResultMuirGlacier = await vm.runBlock({
      block: getBlock(common1),
      skipBlockValidation: true,
      generate: true,
    })
    const txResultChainstart = await vm_noSelect.runBlock({
      block: getBlock(common2),
      skipBlockValidation: true,
      generate: true,
    })
    t.ok(
      txResultChainstart.results[0].gasUsed.toNumber() == 21000 + 68 * 3 + 3 + 50,
      'tx charged right gas on chainstart hard fork'
    )
    t.ok(
      txResultMuirGlacier.results[0].gasUsed.toNumber() == 21000 + 32000 + 16 * 3 + 3 + 800,
      'tx charged right gas on muir glacier hard fork'
    )
    t.end()
  })
})

tape('runBlock() -> API parameter usage/data errors', async (t) => {
  const vm = new VM({ common })

  t.test('should fail when runTx fails', async (st) => {
    const blockRlp = testData.blocks[0].rlp
    const block = Block.fromRLPSerializedBlock(blockRlp)

    // The mocked VM uses a mocked runTx
    // which always returns an error.
    await vm
      .runBlock({ block, skipBlockValidation: true })
      .then(() => t.fail('should have returned error'))
      .catch((e) => t.ok(e.message.includes("sender doesn't have enough funds to send tx")))

    st.end()
  })

  t.test('should fail when block gas limit higher than 2^63-1', async (t) => {
    const vm = new VM({ common })

    const block = Block.fromBlockData({
      header: {
        ...testData.blocks[0].header,
        gasLimit: Buffer.from('8000000000000000', 16),
      },
    })
    await vm
      .runBlock({ block })
      .then(() => t.fail('should have returned error'))
      .catch((e) => t.ok(e.message.includes('Invalid block')))

    t.end()
  })

  t.test('should fail when block validation fails', async (t) => {
    const vm = new VM({ common })

    const blockRlp = testData.blocks[0].rlp
    const block = Object.create(Block.fromRLPSerializedBlock(blockRlp))
    block.validate = async () => {
      throw new Error('test')
    }

    await vm
      .runBlock({ block })
      .then(() => t.fail('should have returned error'))
      .catch((e) => t.ok(e.message.includes('test')))

    t.end()
  })

  t.test('should fail when tx gas limit higher than block gas limit', async (t) => {
    const vm = new VM({ common })

    const blockRlp = testData.blocks[0].rlp
    const block = Object.create(Block.fromRLPSerializedBlock(blockRlp))
    // modify first tx's gasLimit
    const { nonce, gasPrice, to, value, data, v, r, s } = block.transactions[0]

    const gasLimit = new BN(Buffer.from('3fefba', 'hex'))
    const opts = { common: block._common }
    block.transactions[0] = new Transaction(
      { nonce, gasPrice, gasLimit, to, value, data, v, r, s },
      opts
    )

    await vm
      .runBlock({ block, skipBlockValidation: true })
      .then(() => t.fail('should have returned error'))
      .catch((e) => t.ok(e.message.includes('higher gas limit')))

    t.end()
  })
})

tape('runBlock() -> runtime behavior', async (t) => {
  // this test actually checks if the DAO fork works. This is not checked in ethereum/tests
  t.test('DAO fork behavior', async (t) => {
    const common = getDAOCommon(1)

    const vm = setupVM({ common })

    const block1: any = rlp.decode(testData.blocks[0].rlp)
    // edit extra data of this block to "dao-hard-fork"
    block1[0][12] = Buffer.from('dao-hard-fork')
    const block = Block.fromValuesArray(block1)
    // @ts-ignore
    await setupPreConditions(vm.stateManager._trie, testData)

    // fill two original DAO child-contracts with funds and the recovery account with funds in order to verify that the balance gets summed correctly
    const fundBalance1 = new BN(Buffer.from('1111', 'hex'))
    const accountFunded1 = createAccount(new BN(0), fundBalance1)
    const DAOFundedContractAddress1 = new Address(
      Buffer.from('d4fe7bc31cedb7bfb8a345f31e668033056b2728', 'hex')
    )
    await vm.stateManager.putAccount(DAOFundedContractAddress1, accountFunded1)

    const fundBalance2 = new BN(Buffer.from('2222', 'hex'))
    const accountFunded2 = createAccount(new BN(0), fundBalance2)
    const DAOFundedContractAddress2 = new Address(
      Buffer.from('b3fb0e5aba0e20e5c49d252dfd30e102b171a425', 'hex')
    )
    await vm.stateManager.putAccount(DAOFundedContractAddress2, accountFunded2)

    const DAORefundAddress = new Address(
      Buffer.from('bf4ed7b27f1d666546e30d74d50d173d20bca754', 'hex')
    )
    const fundBalanceRefund = new BN(Buffer.from('4444', 'hex'))
    const accountRefund = createAccount(new BN(0), fundBalanceRefund)
    await vm.stateManager.putAccount(DAORefundAddress, accountRefund)

    await vm.runBlock({
      block,
      skipBlockValidation: true,
      generate: true,
    })

    const DAOFundedContractAccount1 = await vm.stateManager.getAccount(DAOFundedContractAddress1)
    t.ok(DAOFundedContractAccount1.balance.isZero()) // verify our funded account now has 0 balance
    const DAOFundedContractAccount2 = await vm.stateManager.getAccount(DAOFundedContractAddress2)
    t.ok(DAOFundedContractAccount2.balance.isZero()) // verify our funded account now has 0 balance

    const DAORefundAccount = await vm.stateManager.getAccount(DAORefundAddress)
    // verify that the refund account gets the summed balance of the original refund account + two child DAO accounts
    const msg =
      'should transfer balance from DAO children to the Refund DAO account in the DAO fork'
    t.ok(DAORefundAccount.balance.eq(new BN(Buffer.from('7777', 'hex'))), msg)

    t.end()
  })

  t.test('should allocate to correct clique beneficiary', async (t) => {
    const common = new Common({ chain: 'goerli' })
    const vm = setupVM({ common })

    const signer = {
      address: new Address(Buffer.from('0b90087d864e82a284dca15923f3776de6bb016f', 'hex')),
      privateKey: Buffer.from(
        '64bf9cc30328b0e42387b3c82c614e6386259136235e20c1357bd11cdee86993',
        'hex'
      ),
      publicKey: Buffer.from(
        '40b2ebdf4b53206d2d3d3d59e7e2f13b1ea68305aec71d5d24cefe7f24ecae886d241f9267f04702d7f693655eb7b4aa23f30dcd0c3c5f2b970aad7c8a828195',
        'hex'
      ),
    }

    const otherUser = {
      address: new Address(Buffer.from('6f62d8382bf2587361db73ceca28be91b2acb6df', 'hex')),
      privateKey: Buffer.from(
        '2a6e9ad5a6a8e4f17149b8bc7128bf090566a11dbd63c30e5a0ee9f161309cd6',
        'hex'
      ),
      publicKey: Buffer.from(
        'ca0a55f6e81cb897aee6a1c390aa83435c41048faa0564b226cfc9f3df48b73e846377fb0fd606df073addc7bd851f22547afbbdd5c3b028c91399df802083a2',
        'hex'
      ),
    }

    // add balance to otherUser to send two txs to zero address
    await vm.stateManager.putAccount(otherUser.address, new Account(new BN(0), new BN(42000)))
    const tx = Transaction.fromTxData(
      { to: Address.zero(), gasLimit: 21000, gasPrice: 1 },
      { common }
    ).sign(otherUser.privateKey)

    // create block with the signer and txs
    const block = Block.genesis(
      { transactions: [tx, tx] },
      { common, cliqueSigner: signer.privateKey }
    )

    await vm.runBlock({ block, skipNonce: true, skipBlockValidation: true, generate: true })
    const account = await vm.stateManager.getAccount(signer.address)
    t.ok(account.balance.eqn(42000), 'beneficiary balance should equal the cost of the txs')
    t.end()
  })
})

async function runBlockAndGetAfterBlockEvent(
  vm: VM,
  runBlockOpts: RunBlockOpts
): Promise<AfterBlockEvent> {
  let results: AfterBlockEvent
  function handler(event: AfterBlockEvent) {
    results = event
  }

  try {
    vm.once('afterBlock', handler)
    await vm.runBlock(runBlockOpts)
  } finally {
    // We need this in case `runBlock` throws before emitting the event.
    // Otherwise we'd be leaking the listener until the next call to runBlock.
    vm.removeListener('afterBlock', handler)
  }

  return results!
}

tape('should correctly reflect generated fields', async (t) => {
  const vm = new VM()

  // We create a block with a receiptTrie and transactionsTrie
  // filled with 0s and no txs. Once we run it we should
  // get a receipt trie root of for the empty receipts set,
  // which is a well known constant.
  const buffer32Zeros = Buffer.alloc(32, 0)
  const block = Block.fromBlockData({
    header: { receiptTrie: buffer32Zeros, transactionsTrie: buffer32Zeros, gasUsed: new BN(1) },
  })

  const results = await runBlockAndGetAfterBlockEvent(vm, {
    block,
    generate: true,
    skipBlockValidation: true,
  })

  t.ok(results.block.header.receiptTrie.equals(KECCAK256_RLP))
  t.ok(results.block.header.transactionsTrie.equals(KECCAK256_RLP))
  t.ok(results.block.header.gasUsed.eqn(0))

  t.end()
})

async function runWithHf(hardfork: string) {
  const vm = setupVM({ common: new Common({ chain: 'mainnet', hardfork }) })

  const blockRlp = testData.blocks[0].rlp
  const block = Block.fromRLPSerializedBlock(blockRlp)

  // @ts-ignore
  await setupPreConditions(vm.stateManager._trie, testData)

  const res = await vm.runBlock({
    block,
    generate: true,
    skipBlockValidation: true,
  })
  return res
}

// TODO: complete on result values and add more usage scenario test cases
tape('runBlock() -> API return values', async (t) => {
  t.test('should return correct HF receipts', async (t) => {
    let res = await runWithHf('byzantium')
    t.equal(
      (res.receipts[0] as PostByzantiumTxReceipt).status,
      1,
      'should return correct post-Byzantium receipt format'
    )

    res = await runWithHf('spuriousDragon')
    t.deepEqual(
      (res.receipts[0] as PreByzantiumTxReceipt).stateRoot,
      Buffer.from('4477e2cfaf9fd2eed4f74426798b55d140f6a9612da33413c4745f57d7a97fcc', 'hex'),
      'should return correct pre-Byzantium receipt format'
    )

    t.end()
  })
})
tape('runBlock() -> reportWitness', async (t) => {
  t.test('should return the witness hashes', async (t) => {
    const vm = setupVM()

    const genesisRlp = testData.genesisRLP
    const genesis = Block.fromRLPSerializedBlock(genesisRlp)

    const blockRlp = testData.blocks[0].rlp
    const block = Block.fromRLPSerializedBlock(blockRlp)

    //@ts-ignore
    await setupPreConditions(vm.stateManager._trie, testData)

    t.ok(
      //@ts-ignore
      vm.stateManager._trie.root.equals(genesis.header.stateRoot),
      'genesis state root should match calculated state root'
    )

    const res = await vm.runBlock({
      block,
      // @ts-ignore
      root: vm.stateManager._trie.root,
      skipBlockValidation: true,
      reportWitness: true,
    })

    t.ok(res.witnessHashes!.length > 0, 'should return witness hashes')

    t.end()
  })
})
tape('runBlock() -> tx types', async (t) => {
  async function simpleRun(vm: VM, transactions: TypedTransaction[]) {
    const common = vm._common

    const blockRlp = testData.blocks[0].rlp
    const block = Block.fromRLPSerializedBlock(blockRlp, { common, freeze: false })

    //@ts-ignore overwrite transactions
    block.transactions = transactions

    if (transactions.some((t) => t.supports(Capability.EIP1559FeeMarket))) {
      // @ts-ignore overwrite read-only property
      block.header.baseFeePerGas = new BN(7)
    }

    //@ts-ignore
    await setupPreConditions(vm.stateManager._trie, testData)

    const res = await vm.runBlock({
      block,
      skipBlockValidation: true,
      generate: true,
    })

    t.ok(
      res.gasUsed.eq(
        res.receipts
          .map((r) => r.gasUsed)
          .reduce((prevValue: BN, currValue: Buffer) => prevValue.add(new BN(currValue)), new BN(0))
      ),
      "gas used should equal transaction's total gasUsed"
    )
  }

  t.test('legacy tx', async (t) => {
    const common = new Common({ chain: 'mainnet', hardfork: 'berlin' })
    const vm = setupVM({ common })

    const address = Address.fromString('0xccfd725760a68823ff1e062f4cc97e1360e8d997')
    await setBalance(vm, address)

    const tx = Transaction.fromTxData({ gasLimit: 53000, value: 1 }, { common, freeze: false })

    tx.getSenderAddress = () => {
      return address
    }

    await simpleRun(vm, [tx])
    t.end()
  })

  t.test('access list tx', async (t) => {
    const common = new Common({ chain: 'mainnet', hardfork: 'berlin' })
    const vm = setupVM({ common })

    const address = Address.fromString('0xccfd725760a68823ff1e062f4cc97e1360e8d997')
    await setBalance(vm, address)

    const tx = AccessListEIP2930Transaction.fromTxData(
      { gasLimit: 53000, value: 1, v: 1, r: 1, s: 1 },
      { common, freeze: false }
    )

    tx.getSenderAddress = () => {
      return address
    }

    await simpleRun(vm, [tx])
    t.end()
  })

  t.test('fee market tx', async (t) => {
    const common = new Common({ chain: 'mainnet', hardfork: 'london' })
    const vm = setupVM({ common })

    const address = Address.fromString('0xccfd725760a68823ff1e062f4cc97e1360e8d997')
    await setBalance(vm, address)

    const tx = FeeMarketEIP1559Transaction.fromTxData(
      { maxFeePerGas: 10, maxPriorityFeePerGas: 4, gasLimit: 100000, value: 6 },
      { common, freeze: false }
    )

    tx.getSenderAddress = () => {
      return address
    }

    await simpleRun(vm, [tx])
    t.end()
  })
})
