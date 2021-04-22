import * as tape from 'tape'
import { addHexPrefix, BN, toBuffer } from 'ethereumjs-util'
import { SecureTrie as Trie } from 'merkle-patricia-tree'
import { Block } from '@ethereumjs/block'
import Blockchain from '@ethereumjs/blockchain'
import { setupPreConditions, verifyPostConditions } from './util'
import Common from '@ethereumjs/common'

const level = require('level')
const levelMem = require('level-mem')

export default async function runBlockchainTest(options: any, testData: any, t: tape.Test) {
  // ensure that the test data is the right fork data
  if (testData.network != options.forkConfigTestSuite) {
    t.comment('skipping test: no data available for ' + <string>options.forkConfigTestSuite)
    return
  }

  if (testData.lastblockhash.substr(0, 2) === '0x') {
    // fix for BlockchainTests/GeneralStateTests/stRandom/*
    testData.lastblockhash = testData.lastblockhash.substr(2)
  }

  const blockchainDB = levelMem()
  const cacheDB = level('./.cachedb')
  const state = new Trie()

  const { common }: { common: Common } = options
  common.setHardforkByBlockNumber(0)

  let validatePow = false
  // Only run with block validation when sealEngine present in test file
  // and being set to Ethash PoW validation
  if (testData.sealEngine && testData.sealEngine === 'Ethash') {
    if (common.consensusAlgorithm() !== 'ethash') {
      t.skip('SealEngine setting is not matching chain consensus type, skip test.')
    }
    validatePow = true
  }

  // create and add genesis block
  const header = formatBlockHeader(testData.genesisBlockHeader)
  const blockData = { header }
  const genesisBlock = Block.fromBlockData(blockData, { common })

  if (testData.genesisRLP) {
    const rlp = toBuffer(testData.genesisRLP)
    t.ok(genesisBlock.serialize().equals(rlp), 'correct genesis RLP')
  }

  const blockchain = await Blockchain.create({
    db: blockchainDB,
    common,
    validateBlocks: true,
    validateConsensus: validatePow,
    genesisBlock,
  })

  if (validatePow) {
    blockchain._ethash!.cacheDB = cacheDB
  }

  let VM
  if (options.dist) {
    VM = require('../dist').default
  } else {
    VM = require('../lib').default
  }

  const vm = await VM.create({
    state,
    blockchain,
    common,
  })

  // set up pre-state
  await setupPreConditions(vm.stateManager._trie, testData)

  t.ok(vm.stateManager._trie.root.equals(genesisBlock.header.stateRoot), 'correct pre stateRoot')

  async function handleError(error: string | undefined, expectException: string) {
    if (expectException) {
      t.pass(`Expected exception ${expectException}`)
    } else {
      console.log(error)
      t.fail(error)
    }
  }

  let currentBlock = new BN(0)
  for (const raw of testData.blocks) {
    const paramFork = `expectException${options.forkConfigTestSuite}`
    // Two naming conventions in ethereum/tests to indicate "exception occurs on all HFs" semantics
    // Last checked: ethereumjs-testing v1.3.1 (2020-05-11)
    const paramAll1 = 'expectExceptionALL'
    const paramAll2 = 'expectException'
    const expectException = raw[paramFork]
      ? raw[paramFork]
      : raw[paramAll1] || raw[paramAll2] || raw.blockHeader == undefined

    // here we convert the rlp to block only to extract the number
    // we have to do this again later because the common might run on a new hardfork
    try {
      const blockRlp = Buffer.from(raw.rlp.slice(2), 'hex')
      const block = Block.fromRLPSerializedBlock(blockRlp, { common })
      currentBlock = block.header.number
    } catch (e) {
      await handleError(e, expectException)
      continue
    }

    try {
      // Update common HF
      common.setHardforkByBlockNumber(currentBlock.toNumber())

      const blockRlp = Buffer.from(raw.rlp.slice(2), 'hex')
      const block = Block.fromRLPSerializedBlock(blockRlp, { common })
      await blockchain.putBlock(block)

      // This is a trick to avoid generating the canonical genesis
      // state. Generating the genesis state is not needed because
      // blockchain tests come with their own `pre` world state.
      // TODO: Add option to `runBlockchain` not to generate genesis state.
      vm._common.genesis().stateRoot = vm.stateManager._trie.root
      await vm.runBlockchain()
      const headBlock = await vm.blockchain.getHead()

      // if the test fails, then block.header is the prej because
      // vm.runBlock has a check that prevents the actual postState from being
      // imported if it is not equal to the expected postState. it is useful
      // for debugging to skip this, so that verifyPostConditions will compare
      // testData.postState to the actual postState, rather than to the preState.
      if (!options.debug) {
        // make sure the state is set before checking post conditions
        vm.stateManager._trie.root = headBlock.header.stateRoot
      }

      if (options.debug) {
        await verifyPostConditions(state, testData.postState, t)
      }

      await cacheDB.close()

      if (expectException) {
        t.fail('expected exception but test did not throw an exception: ' + <string>expectException)
        return
      }
    } catch (error) {
      // caught an error, reduce block number
      currentBlock.isubn(1)
      await handleError(error, expectException)
    }
  }
  t.equal(
    (blockchain.meta as any).rawHead.toString('hex'),
    testData.lastblockhash,
    'correct last header block'
  )
  await cacheDB.close()
}

function formatBlockHeader(data: any) {
  const r: any = {}
  const keys = Object.keys(data)
  keys.forEach(function (key) {
    r[key] = addHexPrefix(data[key])
  })
  return r
}
