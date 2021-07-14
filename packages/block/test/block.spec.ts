import tape from 'tape'
import { BN, keccak256, rlp, zeros } from 'ethereumjs-util'
import Common, { Chain, Hardfork } from '@ethereumjs/common'
import { Block, BlockBuffer, BlockHeader } from '../src'
import blockFromRpc from '../src/from-rpc'
import { Mockchain } from './mockchain'
import { createBlock } from './util'
import * as testDataFromRpcGoerli from './testdata/testdata-from-rpc-goerli.json'

tape('[Block]: block functions', function (t) {
  t.test('should test block initialization', function (st) {
    const common = new Common({ chain: Chain.Ropsten, hardfork: Hardfork.Chainstart })
    const genesis = Block.genesis({}, { common })
    st.ok(genesis.hash().toString('hex'), 'block should initialize')

    // test default freeze values
    // also test if the options are carried over to the constructor
    let block = Block.fromBlockData({})
    st.ok(Object.isFrozen(block), 'block should be frozen by default')

    block = Block.fromBlockData({}, { freeze: false })
    st.ok(!Object.isFrozen(block), 'block should not be frozen when freeze deactivated in options')

    const rlpBlock = block.serialize()
    block = Block.fromRLPSerializedBlock(rlpBlock)
    st.ok(Object.isFrozen(block), 'block should be frozen by default')

    block = Block.fromRLPSerializedBlock(rlpBlock, { freeze: false })
    st.ok(!Object.isFrozen(block), 'block should not be frozen when freeze deactivated in options')

    const zero = Buffer.alloc(0)
    const headerArray = []
    for (let item = 0; item < 15; item++) {
      headerArray.push(zero)
    }

    // mock header data (if set to zeros(0) header throws)
    headerArray[0] = zeros(32) //parentHash
    headerArray[2] = zeros(20) //coinbase
    headerArray[3] = zeros(32) //stateRoot
    headerArray[4] = zeros(32) //transactionsTrie
    headerArray[5] = zeros(32) //receiptTrie
    headerArray[13] = zeros(32) // mixHash
    headerArray[14] = zeros(8) // nonce

    const valuesArray = <BlockBuffer>[headerArray, [], []]

    block = Block.fromValuesArray(valuesArray)
    st.ok(Object.isFrozen(block), 'block should be frozen by default')

    block = Block.fromValuesArray(valuesArray, { freeze: false })
    st.ok(!Object.isFrozen(block), 'block should not be frozen when freeze deactivated in options')

    st.end()
  })

  t.test('should initialize with undefined parameters without throwing', function (st) {
    st.doesNotThrow(function () {
      Block.fromBlockData()
    })
    st.end()
  })

  t.test('should initialize with null parameters without throwing', function (st) {
    st.doesNotThrow(function () {
      const common = new Common({ chain: 'ropsten' })
      const opts = { common }
      Block.fromBlockData({}, opts)
      st.end()
    })
  })
  t.test(
    'should throw when trying to initialize with uncle headers on a PoA network',
    function (st) {
      const common = new Common({ chain: 'rinkeby' })
      const uncleBlock = Block.fromBlockData(
        { header: { extraData: Buffer.alloc(117) } },
        { common }
      )

      st.throws(function () {
        Block.fromBlockData({ uncleHeaders: [uncleBlock.header] }, { common })
      })
      st.end()
    }
  )

  const testData = require('./testdata/testdata.json')

  t.test('should test block validation on pow chain', async function (st) {
    const blockRlp = testData.blocks[0].rlp
    const block = Block.fromRLPSerializedBlock(blockRlp)
    const blockchain = new Mockchain()
    const genesisBlock = Block.fromRLPSerializedBlock(testData.genesisRLP)
    await blockchain.putBlock(genesisBlock)
    st.doesNotThrow(async () => {
      await block.validate(blockchain)
      st.end()
    })
  })

  t.test('should test block validation on poa chain', async function (st) {
    const common = new Common({ chain: 'goerli', hardfork: 'chainstart' })
    const blockchain = new Mockchain()
    const block = blockFromRpc(testDataFromRpcGoerli, [], { common })

    const genesis = Block.genesis({}, { common })
    await blockchain.putBlock(genesis)

    const parentBlock = Block.fromBlockData(
      {
        header: {
          number: block.header.number.subn(1),
          timestamp: block.header.timestamp.subn(1000),
          gasLimit: block.header.gasLimit,
        },
      },
      { common, freeze: false }
    )
    parentBlock.hash = () => {
      return block.header.parentHash
    }
    await blockchain.putBlock(parentBlock)

    await blockchain.putBlock(block)
    try {
      await block.validate(blockchain)
      st.pass('does not throw')
    } catch (error) {
      st.fail('error thrown')
    }
    st.end()
  })

  async function testTransactionValidation(st: tape.Test, block: Block) {
    st.ok(block.validateTransactions())
    st.ok(await block.validateTransactionsTrie())
  }

  t.test('should test transaction validation', async function (st) {
    const blockRlp = testData.blocks[0].rlp
    const block = Block.fromRLPSerializedBlock(blockRlp, { freeze: false })
    await testTransactionValidation(st, block)
    ;(block.header as any).transactionsTrie = Buffer.alloc(32)
    try {
      await block.validateData()
      st.fail('should throw')
    } catch (error) {
      st.equal(error.message, 'invalid transaction trie')
    }
    st.end()
  })

  t.test('should test transaction validation with empty transaction list', async function (st) {
    const block = Block.fromBlockData({})
    await testTransactionValidation(st, block)
    st.end()
  })

  t.test('should test transaction validation with legacy tx in london', async function (st) {
    const common = new Common({ chain: 'goerli', hardfork: 'london' })
    const blockRlp = testData.blocks[0].rlp
    const block = Block.fromRLPSerializedBlock(blockRlp, { common, freeze: false })
    await testTransactionValidation(st, block)
    ;(block.transactions[0] as any).gasPrice = new BN(0)
    const result = block.validateTransactions(true)
    st.ok(
      result[0].includes('tx unable to pay base fee (non EIP-1559 tx)'),
      'should throw when legacy tx is unable to pay base fee'
    )
    st.end()
  })

  const testData2 = require('./testdata/testdata2.json')
  t.test('should test uncles hash validation', async function (st) {
    const blockRlp = testData2.blocks[2].rlp
    const block = Block.fromRLPSerializedBlock(blockRlp, { freeze: false })
    st.equal(block.validateUnclesHash(), true)
    ;(block.header as any).uncleHash = Buffer.alloc(32)
    try {
      await block.validateData()
      st.fail('should throw')
    } catch (error) {
      st.equal(error.message, 'invalid uncle hash')
    }
    st.end()
  })

  t.test('should throw if an uncle is listed twice', async function (st) {
    const blockchain = new Mockchain()

    const genesis = Block.genesis({})
    await blockchain.putBlock(genesis)

    const uncleBlock1 = createBlock(genesis, 'uncle')

    const block1 = createBlock(genesis, 'block1')
    const block2 = createBlock(block1, 'block1', [uncleBlock1.header, uncleBlock1.header])

    await blockchain.putBlock(uncleBlock1)
    await blockchain.putBlock(block1)
    await blockchain.putBlock(block2)

    try {
      await block2.validate(blockchain)
      st.fail('cannot reach this')
    } catch (e) {
      st.pass('block throws if the uncle is included twice in the block')
    }
    st.end()
  })

  t.test('should throw if an uncle is included before', async function (st) {
    const blockchain = new Mockchain()

    const genesis = Block.genesis({})
    await blockchain.putBlock(genesis)

    const uncleBlock = createBlock(genesis, 'uncle')

    const block1 = createBlock(genesis, 'block1')
    const block2 = createBlock(block1, 'block2', [uncleBlock.header])
    const block3 = createBlock(block2, 'block3', [uncleBlock.header])

    await blockchain.putBlock(uncleBlock)
    await blockchain.putBlock(block1)
    await blockchain.putBlock(block2)
    await blockchain.putBlock(block3)

    await uncleBlock.validate(blockchain)

    await block1.validate(blockchain)
    await block2.validate(blockchain)

    try {
      await block3.validate(blockchain)
      st.fail('cannot reach this')
    } catch (e) {
      st.pass('block throws if uncle is already included')
    }
    st.end()
  })

  t.test(
    'should throw if the uncle parent block is not part of the canonical chain',
    async function (st) {
      const blockchain = new Mockchain()

      const genesis = Block.genesis({})
      await blockchain.putBlock(genesis)

      const emptyBlock = Block.fromBlockData({ header: { number: new BN(1) } })

      //assertion
      if (emptyBlock.hash().equals(genesis.hash())) {
        st.fail('should create an unique bogus block')
      }

      await blockchain.putBlock(emptyBlock)

      const uncleBlock = createBlock(emptyBlock, 'uncle')
      const block1 = createBlock(genesis, 'block1')
      const block2 = createBlock(block1, 'block2')
      const block3 = createBlock(block2, 'block3', [uncleBlock.header])

      await blockchain.putBlock(uncleBlock)
      await blockchain.putBlock(block1)
      await blockchain.putBlock(block2)
      await blockchain.putBlock(block3)

      try {
        await block3.validate(blockchain)
        st.fail('cannot reach this')
      } catch (e) {
        st.pass('block throws if uncle parent hash is not part of the canonical chain')
      }
      st.end()
    }
  )

  t.test('should throw if the uncle is too old', async function (st) {
    const blockchain = new Mockchain()

    const genesis = Block.genesis({})
    await blockchain.putBlock(genesis)

    const uncleBlock = createBlock(genesis, 'uncle')

    let lastBlock = genesis
    for (let i = 0; i < 7; i++) {
      const block = createBlock(lastBlock, 'block' + i.toString())
      await blockchain.putBlock(block)
      lastBlock = block
    }

    const blockWithUnclesTooOld = createBlock(lastBlock, 'too-old-uncle', [uncleBlock.header])

    try {
      await blockWithUnclesTooOld.validate(blockchain)
      st.fail('cannot reach this')
    } catch (e) {
      st.pass('block throws uncle is too old')
    }
    st.end()
  })

  t.test('should throw if uncle is too young', async function (st) {
    const blockchain = new Mockchain()

    const genesis = Block.genesis({})
    await blockchain.putBlock(genesis)

    const uncleBlock = createBlock(genesis, 'uncle')
    const block1 = createBlock(genesis, 'block1', [uncleBlock.header])

    await blockchain.putBlock(uncleBlock)
    await blockchain.putBlock(block1)

    try {
      await block1.validate(blockchain)
      st.fail('cannot reach this')
    } catch (e) {
      st.pass('block throws uncle is too young')
    }
    st.end()
  })

  t.test('should throw if the uncle header is invalid', async function (st) {
    const blockchain = new Mockchain()

    const genesis = Block.genesis({})
    await blockchain.putBlock(genesis)

    const uncleBlock = Block.fromBlockData({
      header: {
        number: genesis.header.number.addn(1),
        parentHash: genesis.hash(),
        timestamp: genesis.header.timestamp.addn(1),
        gasLimit: new BN(5000),
        difficulty: new BN(0), // invalid difficulty
      },
    })

    const block1 = createBlock(genesis, 'block1')
    const block2 = createBlock(block1, 'block2', [uncleBlock.header])

    await blockchain.putBlock(uncleBlock)
    await blockchain.putBlock(block1)
    await blockchain.putBlock(block2)

    try {
      await block2.validate(blockchain)
      st.fail('cannot reach this')
    } catch (e) {
      st.pass('block throws uncle header is invalid')
    }
    st.end()
  })

  t.test('throws if more than 2 uncles included', async function (st) {
    const blockchain = new Mockchain()

    const genesis = Block.genesis({})
    await blockchain.putBlock(genesis)

    const uncleBlock1 = createBlock(genesis, 'uncle1')
    const uncleBlock2 = createBlock(genesis, 'uncle2')
    const uncleBlock3 = createBlock(genesis, 'uncle3')

    // sanity check
    if (
      uncleBlock1.hash().equals(uncleBlock2.hash()) ||
      uncleBlock2.hash().equals(uncleBlock3.hash())
    ) {
      st.fail('uncles 1/2/3 should be unique')
    }

    const block1 = createBlock(genesis, 'block1')
    const block2 = createBlock(block1, 'block1', [
      uncleBlock1.header,
      uncleBlock2.header,
      uncleBlock3.header,
    ])

    await blockchain.putBlock(uncleBlock1)
    await blockchain.putBlock(uncleBlock2)
    await blockchain.putBlock(uncleBlock3)
    await blockchain.putBlock(block1)
    await blockchain.putBlock(block2)

    try {
      await block2.validate(blockchain)
      st.fail('cannot reach this')
    } catch (e) {
      st.pass('block throws if more than 2 uncles are included')
    }
    st.end()
  })

  t.test('throws if uncle is a canonical block', async function (st) {
    const blockchain = new Mockchain()

    const genesis = Block.genesis({})
    await blockchain.putBlock(genesis)

    const block1 = createBlock(genesis, 'block1')
    const block2 = createBlock(block1, 'block2', [block1.header])

    await blockchain.putBlock(block1)
    await blockchain.putBlock(block2)

    try {
      await block2.validate(blockchain)
      st.fail('cannot reach this')
    } catch (e) {
      st.pass('block throws if an uncle is a canonical block')
    }
    st.end()
  })

  t.test('successfully validates uncles', async function (st) {
    const blockchain = new Mockchain()

    const genesis = Block.genesis({})
    await blockchain.putBlock(genesis)

    const uncleBlock = createBlock(genesis, 'uncle')
    await blockchain.putBlock(uncleBlock)

    const block1 = createBlock(genesis, 'block1')
    const block2 = createBlock(block1, 'block2', [uncleBlock.header])

    await blockchain.putBlock(block1)
    await blockchain.putBlock(block2)

    await block1.validate(blockchain)
    await block2.validate(blockchain)
    st.pass('uncle blocks validated succesfully')

    st.end()
  })

  t.test(
    'should select the right hardfork for uncles at a hardfork transition',
    async function (st) {
      /**
       * This test creates a chain around mainnet fork blocks:
       *      berlin         london
       *                |     |-> u <---|
       * @ -> @ -> @ ---|---> @ -> @ -> @
       * |-> u <---|               | -> @
       *    ^----------------------------
       * @ = block
       * u = uncle block
       *
       * There are 3 pre-fork blocks, with 1 pre-fork uncle
       * There are 3 blocks after the fork, with 1 uncle after the fork
       *
       * The following situations are tested:
       * Pre-fork block can have legacy uncles
       * London block has london uncles
       * London block has legacy uncles
       * London block has legacy uncles, where hardforkByBlockNumber set to false (this should throw)
       *    In this situation, the london block creates a london uncle, but this london uncle should be
       *    a berlin block, and therefore has no base fee. But, since common is still london, base fee
       *    is expected
       * It is tested that common does not change
       */
      const blockchain = new Mockchain()

      const common = new Common({ chain: Chain.Mainnet })
      common.setHardfork('berlin')

      const mainnetForkBlock = common.hardforkBlockBN('london')
      const rootBlock = Block.fromBlockData({
        header: {
          number: mainnetForkBlock.subn(3),
          gasLimit: new BN(5000),
        },
      })

      await blockchain.putBlock(rootBlock)

      const unclePreFork = createBlock(rootBlock, 'unclePreFork', [], common)
      const canonicalBlock = createBlock(rootBlock, 'canonicalBlock', [], common)
      await blockchain.putBlock(canonicalBlock)
      const preForkBlock = createBlock(
        canonicalBlock,
        'preForkBlock',
        [unclePreFork.header],
        common
      )
      await blockchain.putBlock(preForkBlock)
      common.setHardfork('london')
      const forkBlock = createBlock(preForkBlock, 'forkBlock', [], common)
      await blockchain.putBlock(forkBlock)
      const uncleFork = createBlock(forkBlock, 'uncleFork', [], common)
      const canonicalBlock2 = createBlock(forkBlock, 'canonicalBlock2', [], common)
      const forkBlock2 = createBlock(canonicalBlock2, 'forkBlock2', [uncleFork.header], common)
      await blockchain.putBlock(canonicalBlock2)
      await blockchain.putBlock(forkBlock)
      await preForkBlock.validate(blockchain)

      st.ok(common.hardfork() === 'london', 'validation did not change common hardfork')
      await forkBlock2.validate(blockchain)

      st.ok(common.hardfork() === 'london', 'validation did not change common hardfork')

      const forkBlock2HeaderData = forkBlock2.header.toJSON()
      const uncleHeaderData = unclePreFork.header.toJSON()

      uncleHeaderData.extraData = '0xffff'
      const uncleHeader = BlockHeader.fromHeaderData(uncleHeaderData)

      forkBlock2HeaderData.uncleHash =
        '0x' + keccak256(rlp.encode([uncleHeader.raw()])).toString('hex')

      const forkBlock_ValidCommon = Block.fromBlockData(
        {
          header: forkBlock2HeaderData,
          uncleHeaders: [uncleHeaderData],
        },
        {
          common,
        }
      )

      await forkBlock_ValidCommon.validate(blockchain)

      st.pass('succesfully validated a pre-london uncle on a london block')
      st.ok(common.hardfork() === 'london', 'validation did not change common hardfork')

      const forkBlock_InvalidCommon = Block.fromBlockData(
        {
          header: forkBlock2HeaderData,
          uncleHeaders: [uncleHeaderData],
        },
        {
          common,
          hardforkByBlockNumber: false,
        }
      )

      try {
        await forkBlock_InvalidCommon.validate(blockchain)
        st.fail('cannot reach this')
      } catch (e) {
        st.ok(
          e.message.includes('with EIP1559 being activated'),
          'explicitly set hardforkByBlockNumber to false, pre-london block interpreted as london block and succesfully failed'
        )
      }

      st.ok(common.hardfork() === 'london', 'validation did not change common hardfork')
      st.end()
    }
  )

  t.test('should test isGenesis (mainnet default)', function (st) {
    const block = Block.fromBlockData({ header: { number: 1 } })
    st.notEqual(block.isGenesis(), true)
    const genesisBlock = Block.fromBlockData({ header: { number: 0 } })
    st.equal(genesisBlock.isGenesis(), true)
    st.end()
  })

  t.test('should test isGenesis (ropsten)', function (st) {
    const common = new Common({ chain: 'ropsten' })
    const block = Block.fromBlockData({ header: { number: 1 } }, { common })
    st.notEqual(block.isGenesis(), true)
    const genesisBlock = Block.fromBlockData({ header: { number: 0 } }, { common })
    st.equal(genesisBlock.isGenesis(), true)
    st.end()
  })

  const testDataGenesis = require('./testdata/genesishashestest.json').test
  t.test('should test genesis hashes (mainnet default)', function (st) {
    const genesis = Block.genesis()
    const genesisRlp = genesis.serialize()
    st.strictEqual(genesisRlp.toString('hex'), testDataGenesis.genesis_rlp_hex, 'rlp hex match')
    st.strictEqual(
      genesis.hash().toString('hex'),
      testDataGenesis.genesis_hash,
      'genesis hash match'
    )
    st.end()
  })

  t.test('should test genesis hashes (ropsten)', function (st) {
    const common = new Common({ chain: 'ropsten', hardfork: 'chainstart' })
    const genesis = Block.genesis({}, { common })
    st.strictEqual(
      genesis.hash().toString('hex'),
      common.genesis().hash.slice(2),
      'genesis hash match'
    )
    st.end()
  })

  t.test('should test genesis hashes (rinkeby)', function (st) {
    const common = new Common({ chain: 'rinkeby', hardfork: 'chainstart' })
    const genesis = Block.genesis({}, { common })
    st.strictEqual(
      genesis.hash().toString('hex'),
      common.genesis().hash.slice(2),
      'genesis hash match'
    )
    st.end()
  })

  t.test('should test genesis parameters (ropsten)', function (st) {
    const common = new Common({ chain: 'ropsten', hardfork: 'chainstart' })
    const genesis = Block.genesis({}, { common })
    const ropstenStateRoot = '217b0bbcfb72e2d57e28f33cb361b9983513177755dc3f33ce3e7022ed62b77b'
    st.strictEqual(
      genesis.header.stateRoot.toString('hex'),
      ropstenStateRoot,
      'genesis stateRoot match'
    )
    st.end()
  })

  t.test('should error on invalid params', function (st) {
    st.throws(() => {
      Block.fromRLPSerializedBlock('1' as any)
    }, 'input must be array')
    st.throws(() => {
      Block.fromValuesArray([1, 2, 3, 4] as any)
    }, 'input length must be 3 or less')
    st.end()
  })

  t.test('should return the same block data from raw()', function (st) {
    const block = Block.fromRLPSerializedBlock(testData2.blocks[2].rlp)
    const blockFromRaw = Block.fromValuesArray(block.raw())
    st.ok(block.hash().equals(blockFromRaw.hash()))
    st.end()
  })

  t.test('should test toJSON', function (st) {
    const block = Block.fromRLPSerializedBlock(testData2.blocks[2].rlp)
    st.equal(typeof block.toJSON(), 'object')
    st.end()
  })

  t.test('DAO hardfork', function (st) {
    const blockData: any = rlp.decode(testData2.blocks[0].rlp)
    // Set block number from test block to mainnet DAO fork block 1920000
    blockData[0][8] = Buffer.from('1D4C00', 'hex')

    const common = new Common({ chain: 'mainnet', hardfork: 'dao' })
    st.throws(
      function () {
        Block.fromValuesArray(blockData, { common })
      },
      /Error: extraData should be 'dao-hard-fork'$/,
      'should throw on DAO HF block with wrong extra data'
    ) // eslint-disable-line

    // Set extraData to dao-hard-fork
    blockData[0][12] = Buffer.from('64616f2d686172642d666f726b', 'hex')

    st.doesNotThrow(function () {
      Block.fromValuesArray(blockData, { common })
    }, 'should not throw on DAO HF block with correct extra data')
    st.end()
  })

  t.test(
    'should set canonical difficulty if I provide a calcDifficultyFromHeader header',
    function (st) {
      const common = new Common({ chain: 'mainnet', hardfork: 'chainstart' })
      const genesis = Block.genesis({}, { common })

      const nextBlockHeaderData = {
        number: genesis.header.number.addn(1),
        timestamp: genesis.header.timestamp.addn(10),
      }

      const blockWithoutDifficultyCalculation = Block.fromBlockData({
        header: nextBlockHeaderData,
      })

      // test if difficulty defaults to 0
      st.ok(
        blockWithoutDifficultyCalculation.header.difficulty.eqn(0),
        'header difficulty should default to 0'
      )

      // test if we set difficulty if we have a "difficulty header" in options; also verify this is equal to reported canonical difficulty.
      const blockWithDifficultyCalculation = Block.fromBlockData(
        {
          header: nextBlockHeaderData,
        },
        {
          calcDifficultyFromHeader: genesis.header,
        }
      )

      st.ok(
        blockWithDifficultyCalculation.header.difficulty.gtn(0),
        'header difficulty should be set if difficulty header is given'
      )
      st.ok(
        blockWithDifficultyCalculation.header
          .canonicalDifficulty(genesis.header)
          .eq(blockWithDifficultyCalculation.header.difficulty),
        'header difficulty is canonical difficulty if difficulty header is given'
      )
      st.ok(
        blockWithDifficultyCalculation.header.validateDifficulty(genesis.header),
        'difficulty should be valid if difficulty header is provided'
      )

      // test if we can provide a block which is too far ahead to still calculate difficulty
      const noParentHeaderData = {
        number: genesis.header.number.addn(1337),
        timestamp: genesis.header.timestamp.addn(10),
      }

      const block_farAhead = Block.fromBlockData(
        {
          header: noParentHeaderData,
        },
        {
          calcDifficultyFromHeader: genesis.header,
        }
      )

      st.ok(
        block_farAhead.header.difficulty.gtn(0),
        'should allow me to provide a bogus next block to calculate difficulty on when providing a difficulty header'
      )
      st.end()
    }
  )
})
