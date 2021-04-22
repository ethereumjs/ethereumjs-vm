import tape from 'tape'
import { BN, toBuffer } from 'ethereumjs-util'
import { Block } from '@ethereumjs/block'
import Common from '@ethereumjs/common'
import Blockchain from '@ethereumjs/blockchain'
import { setupVM } from './utils'
import { setupPreConditions } from '../util'
import * as testData from './testdata/blockchain.json'
import { DefaultStateManager } from '../../lib/state'

const level = require('level-mem')

Error.stackTraceLimit = 100

tape('runBlockchain', (t) => {
  const blockchainDB = level()
  const common = new Common({ chain: 'goerli', hardfork: 'chainstart' })

  t.test('should run without a blockchain parameter', async (st) => {
    const vm = await setupVM({ common })
    st.doesNotThrow(async function () {
      await vm.runBlockchain()
      st.end()
    })
  })

  t.test('should run without blocks', async (st) => {
    const vm = await setupVM({ common })
    st.doesNotThrow(async function () {
      await vm.runBlockchain()
      st.end()
    })
  })

  t.test('should run with genesis block', async (st) => {
    try {
      const genesisBlock = Block.genesis(undefined, { common })

      const blockchain = await Blockchain.create({
        db: blockchainDB,
        common,
        validateBlocks: false,
        validateConsensus: false,
        genesisBlock,
      })
      const vm = await setupVM({ genesisBlock, blockchain })

      st.ok(blockchain.meta.genesis, 'genesis should be set for blockchain')

      // @ts-ignore
      await vm.runBlockchain()
      st.end()
    } catch (e) {
      st.end(e)
    }
  })

  // TODO: test has been moved over from index.spec.ts, check for redundancy
  t.test('should run blockchain with mocked runBlock', async (st) => {
    const common = new Common({ chain: 'ropsten' })
    const genesisRlp = Buffer.from(testData.genesisRLP.slice(2), 'hex')
    const genesisBlock = Block.fromRLPSerializedBlock(genesisRlp, { common })

    const blockRlp = Buffer.from(testData.blocks[0].rlp.slice(2), 'hex')
    const block = Block.fromRLPSerializedBlock(blockRlp, { common })

    const vm = await setupVM({ common, genesisBlock })

    st.equal(vm.blockchain.meta.genesis?.toString('hex'), testData.genesisBlockHeader.hash.slice(2))

    await vm.blockchain.putBlock(block)
    const head = await vm.blockchain.getHead()
    st.equal(head.hash().toString('hex'), testData.blocks[0].blockHeader.hash.slice(2))

    await setupPreConditions((vm.stateManager as DefaultStateManager)._trie, testData)

    vm.runBlock = async () => new Promise((resolve, reject) => reject(new Error('test')))

    try {
      await vm.runBlockchain()
      st.fail("it hasn't returned any errors")
    } catch (e) {
      st.equal(e.message, 'test', "it has correctly propagated runBlock's error")
      st.end()
    }
  })

  // TODO: test has been moved over from index.spec.ts, check for redundancy
  t.test('should run blockchain with blocks', async (st) => {
    const common = new Common({ chain: 'ropsten' })

    const genesisRlp = toBuffer(testData.genesisRLP)
    const genesisBlock = Block.fromRLPSerializedBlock(genesisRlp, { common })

    const blockRlp = toBuffer(testData.blocks[0].rlp)
    const block = Block.fromRLPSerializedBlock(blockRlp, { common })

    const vm = await setupVM({ common, genesisBlock })

    st.equal(vm.blockchain.meta.genesis?.toString('hex'), testData.genesisBlockHeader.hash.slice(2))

    await vm.blockchain.putBlock(block)
    const head = await vm.blockchain.getHead()
    st.equal(head.hash().toString('hex'), testData.blocks[0].blockHeader.hash.slice(2))

    await setupPreConditions((vm.stateManager as DefaultStateManager)._trie, testData)

    await vm.runBlockchain()

    st.end()
  })

  t.test('should run with valid and invalid blocks', async (st) => {
    const blockchainDB = level()

    const common = new Common({ chain: 'mainnet', hardfork: 'chainstart' })
    const genesisBlock = Block.genesis(undefined, { common })
    const blockchain = await Blockchain.create({
      db: blockchainDB,
      common,
      validateBlocks: false,
      validateConsensus: false,
      genesisBlock,
    })

    const vm = await setupVM({ genesisBlock, blockchain })

    // Produce error on the third time runBlock is called
    let runBlockInvocations = 0
    ;(<any>vm).runBlock = () =>
      new Promise((resolve, reject) => {
        runBlockInvocations++
        if (runBlockInvocations === 3) {
          return reject(new Error('test'))
        }
        resolve({})
      })

    const b1 = createBlock(genesisBlock, 1, { common })
    const b2 = createBlock(b1, 2, { common })
    const b3 = createBlock(b2, 3, { common })

    await blockchain.putBlock(b1)
    await blockchain.putBlock(b2)
    await blockchain.putBlock(b3)

    let head = await blockchain.getHead()
    st.deepEqual(head.hash(), b3.hash(), 'block3 should be the current head')

    try {
      await vm.runBlockchain()
      st.fail('should have returned error')
    } catch (e) {
      st.equal(e.message, 'test')

      head = await blockchain.getHead()
      st.deepEqual(head.hash(), b2.hash(), 'should have removed invalid block from head')

      st.end()
    }
  })
})

function createBlock(parent: Block | undefined, n = 0, opts = {}) {
  if (!parent) {
    return Block.genesis(undefined, opts)
  }

  const blockData = {
    header: {
      number: n,
      parentHash: parent.hash(),
      difficulty: new BN(0xfffffff),
      stateRoot: parent.header.stateRoot,
    },
  }
  return Block.fromBlockData(blockData, opts)
}
