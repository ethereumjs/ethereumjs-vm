import { BN } from 'ethereumjs-util'
import Common from '@ethereumjs/common'
import { Block, BlockHeader, BlockOptions } from '@ethereumjs/block'
import tape from 'tape'
import Blockchain from '../src'
import { generateBlockchain, generateBlocks, isConsecutive, createTestDB } from './util'
import * as testData from './testdata/testdata.json'
import blocksData from './testdata/blocks_mainnet.json'

const level = require('level-mem')

tape('blockchain test', (t) => {
  t.test('should not crash on getting head of a blockchain without a genesis', async (st) => {
    const blockchain = new Blockchain({
      validateBlocks: true,
      validateConsensus: false,
    })
    await blockchain.getHead()
    st.end()
  })

  t.test('should initialize correctly', async (st) => {
    const common = new Common({ chain: 'ropsten' })
    const blockchain = new Blockchain({ common })

    const head = await blockchain.getHead()
    const iteratorHead = await blockchain.getIteratorHead()

    st.equals(
      head.hash().toString('hex'),
      common.genesis().hash.slice(2),
      'correct genesis hash (getHead())'
    )
    st.equals(
      iteratorHead.hash().toString('hex'),
      common.genesis().hash.slice(2),
      'correct genesis hash (getIteratorHead())'
    )
    st.end()
  })

  t.test('should initialize correctly with Blockchain.fromBlocksData()', async (st) => {
    const common = new Common({ chain: 'mainnet' })
    const blockchain = await Blockchain.fromBlocksData(blocksData, {
      validateBlocks: true,
      validateConsensus: false,
      common,
    })

    const head = await blockchain.getHead()

    st.equals(head.header.number.toNumber(), 5, 'correct block number')
    st.end()
  })

  t.test('should only initialize with supported consensus validation options', (st) => {
    let common = new Common({ chain: 'mainnet' })
    st.doesNotThrow(() => {
      new Blockchain({ common, validateConsensus: true })
    })
    st.doesNotThrow(() => {
      new Blockchain({ common, validateBlocks: true })
    })

    common = new Common({ chain: 'goerli' })
    st.doesNotThrow(() => {
      new Blockchain({ common, validateConsensus: true })
    })
    st.doesNotThrow(() => {
      new Blockchain({ common, validateBlocks: true })
    })
    st.end()
  })

  t.test('should add a genesis block without errors', async (st) => {
    const genesisBlock = Block.genesis()
    const blockchain = new Blockchain({
      validateBlocks: true,
      validateConsensus: false,
      genesisBlock,
    })
    await blockchain.initPromise
    st.ok(
      genesisBlock.hash().equals(blockchain.meta.genesis!),
      'genesis block hash should be correct'
    )
    st.end()
  })

  t.test('should not validate a block incorrectly flagged as genesis', async (st) => {
    const genesisBlock = Block.fromBlockData({ header: { number: new BN(8) } })
    try {
      await Blockchain.create({
        validateBlocks: true,
        validateConsensus: false,
        genesisBlock,
      })
    } catch (error) {
      st.ok(error, 'returned with error')
      st.end()
    }
  })

  t.test('should initialize with a genesis block', async (st) => {
    const blockchain = new Blockchain({
      validateBlocks: true,
      validateConsensus: false,
    })
    const blocks = await blockchain.getBlocks(0, 5, 0, false)
    st.equal(blocks!.length, 1)
    st.end()
  })

  t.test('should return headers', async (st) => {
    const blockchain = new Blockchain({
      validateBlocks: true,
      validateConsensus: false,
    })
    const genesis = await blockchain.getBlock(new BN(0))
    const header = BlockHeader.fromHeaderData(
      {
        gasLimit: genesis.header.gasLimit,
        parentHash: genesis.hash(),
        number: new BN(1),
        timestamp: genesis.header.timestamp.addn(1),
      },
      { calcDifficultyFromHeader: genesis.header }
    )
    await blockchain.putHeader(header)
    const BNresult = await blockchain.getHeader(new BN(1))
    st.ok(BNresult.hash().equals(header.hash()))
    const numberResult = await blockchain.getHeader(1)
    st.ok(numberResult.hash().equals(header.hash()))
    const BufferResult = await blockchain.getHeader(header.hash())
    st.ok(BufferResult.hash().equals(header.hash()))
    st.end()
  })

  t.test('should add 10 blocks, one at a time', async (st) => {
    const blocks: Block[] = []
    const gasLimit = 8000000

    const genesisBlock = Block.genesis({ header: { gasLimit } })
    blocks.push(genesisBlock)

    const blockchain = new Blockchain({
      validateBlocks: true,
      validateConsensus: false,
      genesisBlock,
    })

    const addNextBlock = async (number: number) => {
      const lastBlock = blocks[number - 1]
      const blockData = {
        header: {
          number,
          parentHash: lastBlock.hash(),
          timestamp: lastBlock.header.timestamp.addn(1),
          gasLimit,
        },
      }
      const block = Block.fromBlockData(blockData, { calcDifficultyFromHeader: lastBlock.header })
      await blockchain.putBlock(block)
      blocks.push(block)

      if (blocks.length < 10) {
        await addNextBlock(number + 1)
      } else {
        const getBlocks = await blockchain.getBlocks(blocks[0].hash(), 10, 0, false)
        st.equal(getBlocks.length, 10)
        st.end()
      }
    }

    await addNextBlock(1)
  })

  t.test('should get block by number', async (st) => {
    const blocks: Block[] = []
    const gasLimit = 8000000

    const genesisBlock = Block.genesis({ header: { gasLimit } })
    blocks.push(genesisBlock)

    const blockchain = new Blockchain({
      validateBlocks: true,
      validateConsensus: false,
      genesisBlock,
    })

    const blockData = {
      header: {
        number: 1,
        parentHash: genesisBlock.hash(),
        timestamp: genesisBlock.header.timestamp.addn(1),
        gasLimit,
      },
    }
    const block = Block.fromBlockData(blockData, {
      calcDifficultyFromHeader: genesisBlock.header,
    })
    blocks.push(block)
    await blockchain.putBlock(block)

    const returnedBlock = await blockchain.getBlock(1)
    if (returnedBlock) {
      st.ok(returnedBlock.hash().equals(blocks[1].hash()))
    } else {
      st.fail('block is not defined!')
    }
    st.end()
  })

  t.test('should get block by hash', async (st) => {
    const gasLimit = 8000000
    const genesisBlock = Block.genesis({ header: { gasLimit } })

    const blockchain = new Blockchain({
      validateBlocks: true,
      validateConsensus: false,
      genesisBlock,
    })
    const block = await blockchain.getBlock(genesisBlock.hash())
    if (block) {
      st.ok(block.hash().equals(genesisBlock.hash()))
    } else {
      st.fail('block is not defined!')
    }
    st.end()
  })

  t.test('should get 5 consecutive blocks, starting from genesis hash', async (st) => {
    const { blockchain, blocks, error } = await generateBlockchain(25)
    st.error(error, 'no error')
    // start: genesisHash, max: 5, skip: 0, reverse: false
    const getBlocks = await blockchain.getBlocks(blocks[0].hash(), 5, 0, false)
    st.equal(getBlocks!.length, 5)
    st.ok(blocks[0].header.number.eq(getBlocks[0].header.number))
    st.ok(isConsecutive(getBlocks!), 'blocks should be consecutive')
    st.end()
  })

  t.test('should get 5 blocks, skipping 1 apart, starting from genesis hash', async (st) => {
    const { blockchain, blocks, error } = await generateBlockchain(25)
    st.error(error, 'no error')
    // start: genesisHash, max: 5, skip: 1, reverse: false
    const getBlocks = await blockchain.getBlocks(blocks[0].hash(), 5, 1, false)
    st.equal(getBlocks!.length, 5, 'should get 5 blocks')
    st.ok(getBlocks![1].header.number.eq(blocks[2].header.number), 'should skip second block')
    st.ok(!isConsecutive(getBlocks!), 'blocks should not be consecutive')
    st.end()
  })

  t.test('should get 4 blocks, skipping 2 apart, starting from genesis hash', async (st) => {
    const { blockchain, blocks, error } = await generateBlockchain(25)
    st.error(error, 'no error')
    // start: genesisHash, max: 4, skip: 2, reverse: false
    const getBlocks = await blockchain.getBlocks(blocks[0].hash(), 4, 2, false)
    st.equal(getBlocks!.length, 4, 'should get 4 blocks')
    st.ok(getBlocks![1].header.number.eq(blocks[3].header.number), 'should skip two blocks apart')
    st.ok(!isConsecutive(getBlocks!), 'blocks should not be consecutive')
    st.end()
  })

  t.test('should get 10 consecutive blocks, starting from genesis hash', async (st) => {
    const { blockchain, blocks, error } = await generateBlockchain(15)
    st.error(error, 'no error')
    // start: genesisHash, max: 17, skip: 0, reverse: false
    const getBlocks = await blockchain.getBlocks(blocks[0].hash(), 17, 0, false)
    st.equal(getBlocks!.length, 15)
    st.ok(getBlocks![0].header.number.eq(blocks[0].header.number))
    st.ok(isConsecutive(getBlocks!), 'blocks should be consecutive')
    st.end()
  })

  t.test('should get 5 consecutive blocks, starting from block 0', async (st) => {
    const { blockchain, blocks, error } = await generateBlockchain(25)
    st.error(error, 'no error')
    // start: 0, max: 5, skip: 0, reverse: false
    const getBlocks = await blockchain.getBlocks(0, 5, 0, false)
    st.equal(getBlocks!.length, 5)
    st.ok(getBlocks![0].header.number.eq(blocks[0].header.number))
    st.ok(isConsecutive(getBlocks!), 'blocks should be consecutive')
    st.end()
  })

  t.test('should get 5 blocks, skipping 1 apart, starting from block 1', async (st) => {
    const { blockchain, blocks, error } = await generateBlockchain(25)
    st.error(error, 'no error')
    // start: 1, max: 5, skip: 1, reverse: false
    const getBlocks = await blockchain.getBlocks(1, 5, 1, false)
    st.equal(getBlocks!.length, 5)
    st.ok(getBlocks![1].header.number.eq(blocks[3].header.number), 'should skip one block')
    st.ok(!isConsecutive(getBlocks!), 'blocks should not be consecutive')
    st.end()
  })

  t.test('should get 5 blocks, skipping 2 apart, starting from block 0', async (st) => {
    const { blockchain, blocks, error } = await generateBlockchain(25)
    st.error(error, 'no error')
    // start: 0, max: 5, skip: 2, reverse: false
    const getBlocks = await blockchain.getBlocks(0, 5, 2, false)
    st.equal(getBlocks!.length, 5)
    st.ok(getBlocks![1].header.number.eq(blocks[3].header.number), 'should skip two blocks')
    st.ok(!isConsecutive(getBlocks!), 'blocks should not be consecutive')
    st.end()
  })

  t.test('should get 15 consecutive blocks, starting from block 0', async (st) => {
    const { blockchain, blocks, error } = await generateBlockchain(15)
    st.error(error, 'no error')
    // start: 0, max: 17, skip: 0, reverse: false
    const getBlocks = await blockchain.getBlocks(0, 17, 0, false)
    st.equal(getBlocks!.length, 15)
    st.ok(getBlocks![0].header.number.eq(blocks[0].header.number))
    st.ok(isConsecutive(getBlocks!), 'blocks should be consecutive')
    st.end()
  })

  t.test('should get 5 consecutive blocks, starting from block 1', async (st) => {
    const { blockchain, blocks, error } = await generateBlockchain(25)
    st.error(error, 'no error')
    // start: 1, max: 5, skip: 0, reverse: false
    const getBlocks = await blockchain.getBlocks(1, 5, 0, false)
    st.equal(getBlocks!.length, 5)
    st.ok(getBlocks![0].header.number.eq(blocks[1].header.number))
    st.ok(isConsecutive(getBlocks!), 'blocks should be consecutive')
    st.end()
  })

  t.test('should get 5 consecutive blocks, starting from block 5', async (st) => {
    const { blockchain, blocks, error } = await generateBlockchain(25)
    st.error(error, 'no error')
    // start: 5, max: 5, skip: 0, reverse: false
    const getBlocks = await blockchain.getBlocks(5, 5, 0, false)
    st.equal(getBlocks!.length, 5)
    st.ok(getBlocks![0].header.number.eq(blocks[5].header.number))
    st.ok(isConsecutive(getBlocks!), 'blocks should be consecutive')
    st.end()
  })

  t.test('should get 5 consecutive blocks, starting from block 5, reversed', async (st) => {
    const { blockchain, blocks, error } = await generateBlockchain(25)
    st.error(error, 'no error')
    // start: 5, max: 5, skip: 0, reverse: true
    const getBlocks = await blockchain.getBlocks(5, 5, 0, true)
    st.equal(getBlocks!.length, 5)
    st.ok(getBlocks![0].header.number.eq(blocks[5].header.number))
    st.ok(isConsecutive(getBlocks!.reverse()), 'blocks should be consecutive')
    st.end()
  })

  t.test('should get 6 consecutive blocks, starting from block 5, reversed', async (st) => {
    const { blockchain, blocks, error } = await generateBlockchain(15)
    st.error(error, 'no error')
    // start: 5, max: 15, skip: 0, reverse: true
    const getBlocks = await blockchain.getBlocks(5, 15, 0, true)
    st.equal(getBlocks!.length, 6)
    st.ok(getBlocks![0].header.number.eq(blocks[5].header.number))
    st.ok(isConsecutive(getBlocks!.reverse()), 'blocks should be consecutive')
    st.end()
  })

  t.test('should get 6 blocks, starting from block 10, reversed, skipping 1 apart', async (st) => {
    const { blockchain, blocks, error } = await generateBlockchain(25)
    st.error(error, 'no error')
    // start: 10, max: 10, skip: 1, reverse: true
    const getBlocks = await blockchain.getBlocks(10, 10, 1, true)
    st.equal(getBlocks!.length, 6)
    st.ok(getBlocks![1].header.number.eq(blocks[8].header.number), 'should skip one block')
    st.ok(!isConsecutive(getBlocks!.reverse()), 'blocks should not be consecutive')
    st.end()
  })

  t.test('should find needed hashes', async (st) => {
    const { blockchain, blocks, error } = await generateBlockchain(25)
    st.error(error, 'no error')
    const neededHash = Buffer.from('abcdef', 'hex')
    const hashes = await blockchain.selectNeededHashes([
      blocks[0].hash(),
      blocks[9].hash(),
      neededHash,
    ])
    st.ok(hashes[0].equals(neededHash))
    st.end()
  })

  t.test('should iterate through 24 blocks', async (st) => {
    const { blockchain, blocks, error } = await generateBlockchain(25)
    st.error(error, 'no error')
    let i = 0
    const iterated = await blockchain.iterator('test', (block: Block) => {
      if (block.hash().equals(blocks[i + 1].hash())) {
        i++
      }
    })
    st.equals(iterated, 24)
    st.equals(i, 24)
    st.end()
  })

  t.test(
    'should iterate through maxBlocks blocks if maxBlocks parameter is provided',
    async (st) => {
      const { blockchain, blocks, error } = await generateBlockchain(25)
      st.error(error, 'no error')
      let i = 0
      const iterated = await blockchain.iterator(
        'test',
        (block: Block) => {
          if (block.hash().equals(blocks[i + 1].hash())) {
            i++
          }
        },
        5
      )
      st.equals(iterated, 5)
      st.equals(i, 5)
      st.end()
    }
  )

  t.test(
    'should iterate through 0 blocks in case 0 maxBlocks parameter is provided',
    async (st) => {
      const { blockchain, blocks, error } = await generateBlockchain(25)
      st.error(error, 'no error')
      let i = 0
      const iterated = await blockchain
        .iterator(
          'test',
          (block: Block) => {
            if (block.hash().equals(blocks[i + 1].hash())) {
              i++
            }
          },
          0
        )
        .catch(() => {
          st.fail('Promise cannot throw when running 0 blocks')
        })
      st.equals(iterated, 0)
      st.equals(i, 0)
      st.end()
    }
  )

  t.test('should throw on a negative maxBlocks parameter in iterator', async (st) => {
    const { blockchain, blocks, error } = await generateBlockchain(25)
    st.error(error, 'no error')
    let i = 0
    await blockchain
      .iterator(
        'test',
        (block: Block) => {
          if (block.hash().equals(blocks[i + 1].hash())) {
            i++
          }
        },
        -1
      )
      .catch(() => {
        st.end()
      })
    // Note: if st.end() is not called (Promise did not throw), then this test fails, as it does not end.
  })

  t.test('should test setHead (@deprecated)/setIteratorHead method', async (st) => {
    const { blockchain, blocks, error } = await generateBlockchain(25)
    st.error(error, 'no error')

    const headBlockIndex = 5

    const headHash = blocks[headBlockIndex].hash()
    await blockchain.setIteratorHead('myHead', headHash)
    const currentHeadBlock = await blockchain.getHead('myHead')

    st.ok(headHash.equals(currentHeadBlock.hash()), 'head hash equals the provided head hash')

    let i = 0
    // check that iterator starts from this head block
    await blockchain.iterator(
      'myHead',
      (block: Block) => {
        if (block.hash().equals(blocks[headBlockIndex + 1].hash())) {
          i++
        }
      },
      5
    )

    st.equals(i, 1)

    st.end()
  })

  t.test('should catch iterator func error', async (st) => {
    const { blockchain, error } = await generateBlockchain(25)
    st.error(error, 'no error')
    try {
      await blockchain.iterator('error', () => {
        throw new Error('iterator func error')
      })
    } catch (error) {
      st.ok(error)
      st.equal(error.message, 'iterator func error', 'should return correct error')
      st.end()
    }
  })

  t.test('should not call iterator function in an empty blockchain', async (st) => {
    const blockchain = new Blockchain({
      validateBlocks: true,
      validateConsensus: false,
    })

    await blockchain.iterator('test', () => {
      st.fail('should not call iterator function')
    })

    st.pass('should finish iterating')
    st.end()
  })

  t.test('should get meta.genesis', async (st) => {
    const { blockchain, blocks, error } = await generateBlockchain(25)
    st.error(error, 'no error')
    st.ok(blockchain.meta.rawHead.equals(blocks[24].hash()), 'should get meta.rawHead')
    st.ok(blockchain.meta.genesis.equals(blocks[0].hash()), 'should get meta.genesis')
    let i = 0
    await blockchain.iterator('test', (block: Block) => {
      if (block.hash().equals(blocks[i + 1].hash())) {
        i++
      }
    })
    st.ok(blockchain.meta.heads['test'], 'should get meta.heads')
    st.end()
  })

  t.test('should add fork header and reset stale heads', async (st) => {
    const { blockchain, blocks, error } = await generateBlockchain(15)
    st.error(error, 'no error')

    await blockchain.putBlocks(blocks.slice(1))

    const common = new Common({ chain: 'mainnet', hardfork: 'chainstart' })
    const headerData = {
      number: 15,
      parentHash: blocks[14].hash(),
      gasLimit: 8000000,
      timestamp: blocks[14].header.timestamp.addn(1),
    }
    const forkHeader = BlockHeader.fromHeaderData(headerData, {
      common,
      calcDifficultyFromHeader: blocks[14].header,
    })

    blockchain._heads['staletest'] = blockchain._headHeaderHash

    await blockchain.putHeader(forkHeader)

    st.ok(blockchain._heads['staletest'].equals(blocks[14].hash()), 'should update stale head')
    st.ok(blockchain._headBlockHash.equals(blocks[14].hash()), 'should update stale headBlock')
    st.end()
  })

  t.test('should delete fork header', async (st) => {
    const { blockchain, blocks, error } = await generateBlockchain(15)
    st.error(error, 'no error')

    const common = new Common({ chain: 'mainnet', hardfork: 'chainstart' })
    const headerData = {
      number: 15,
      parentHash: blocks[14].hash(),
      gasLimit: 8000000,
      timestamp: blocks[14].header.timestamp.addn(1),
    }
    const forkHeader = BlockHeader.fromHeaderData(headerData, {
      common,
      calcDifficultyFromHeader: blocks[14].header,
    })

    blockchain._heads['staletest'] = blockchain._headHeaderHash

    await blockchain.putHeader(forkHeader)

    st.ok(blockchain._heads['staletest'].equals(blocks[14].hash()), 'should update stale head')
    st.ok(blockchain._headBlockHash.equals(blocks[14].hash()), 'should update stale headBlock')

    await blockchain.delBlock(forkHeader.hash())

    st.ok(blockchain._headHeaderHash.equals(blocks[14].hash()), 'should reset headHeader')
    st.ok(blockchain._headBlockHash.equals(blocks[14].hash()), 'should not change headBlock')
    st.end()
  })

  t.test('should delete blocks', async (st) => {
    const { blockchain, blocks, error } = await generateBlockchain(25)
    st.error(error, 'no error')

    const delNextBlock = async (number: number): Promise<any> => {
      const block = blocks[number]
      await blockchain.delBlock(block.hash())
      if (number > 6) {
        return delNextBlock(--number)
      }
    }

    await delNextBlock(9)
    st.ok(blockchain._headHeaderHash.equals(blocks[5].hash()), 'should have block 5 as head')
    st.end()
  })

  t.test('should delete blocks and children', async (st) => {
    const { blockchain, blocks, error } = await generateBlockchain(25)
    st.error(error, 'no error')
    await blockchain.delBlock(blocks[1].hash())
    st.ok(blockchain._headHeaderHash.equals(blocks[0].hash()), 'should have genesis as head')
    st.end()
  })

  t.test('should put one block at a time', async (st) => {
    const blocks = generateBlocks(15)
    const blockchain = new Blockchain({
      validateBlocks: true,
      validateConsensus: false,
      genesisBlock: blocks[0],
    })
    await blockchain.putBlock(blocks[1])
    await blockchain.putBlock(blocks[2])
    await blockchain.putBlock(blocks[3])
    st.end()
  })

  t.test('should put multiple blocks at once', async (st) => {
    const blocks: Block[] = []
    const genesisBlock = Block.genesis({ header: { gasLimit: 8000000 } })
    blocks.push(...generateBlocks(15, [genesisBlock]))
    const blockchain = new Blockchain({
      validateBlocks: true,
      validateConsensus: false,
      genesisBlock,
    })
    await blockchain.putBlocks(blocks.slice(1))
    st.end()
  })

  t.test('should get heads', async (st) => {
    const [db, genesis] = await createTestDB()
    const blockchain = new Blockchain({ db: db })
    const head = await blockchain.getHead()
    if (genesis) {
      st.ok(head.hash().equals(genesis.hash()), 'should get head')
      st.equals(
        (blockchain as any)._heads['head0'].toString('hex'),
        'abcd',
        'should get state root heads'
      )
      st.end()
    } else {
      st.fail()
    }
  })

  t.test('should validate', async (st) => {
    const genesisBlock = Block.genesis({ header: { gasLimit: 8000000 } })
    const blockchain = new Blockchain({
      validateBlocks: true,
      validateConsensus: false,
      genesisBlock,
    })

    const invalidBlock = Block.fromBlockData({ header: { number: 50 } })
    try {
      await blockchain.putBlock(invalidBlock)
      st.fail('should not validate an invalid block')
    } catch (error) {
      t.ok(error, 'should not validate an invalid block')
    }
    st.end()
  })

  t.test('should add block with body', async (st) => {
    const genesisRlp = Buffer.from(testData.genesisRLP.slice(2), 'hex')
    const genesisBlock = Block.fromRLPSerializedBlock(genesisRlp, {
      initWithGenesisHeader: true,
    })
    const blockchain = new Blockchain({
      validateBlocks: true,
      validateConsensus: false,
      genesisBlock,
    })

    const blockRlp = Buffer.from(testData.blocks[0].rlp.slice(2), 'hex')
    const block = Block.fromRLPSerializedBlock(blockRlp)
    await blockchain.putBlock(block)
    st.end()
  })

  t.test('uncached db ops', async (st) => {
    const [db, genesis] = await createTestDB()
    if (!genesis) {
      return st.fail('genesis not defined!')
    }
    const blockchain = new Blockchain({ db })

    const number = await blockchain.dbManager.hashToNumber(genesis?.hash())
    st.ok(number.isZero(), 'should perform _hashToNumber correctly')

    const hash = await blockchain.dbManager.numberToHash(new BN(0))
    st.ok(genesis.hash().equals(hash), 'should perform _numberToHash correctly')

    // cast the blockchain as <any> in order to get access to the private getTotalDifficulty
    const td = await (<any>blockchain).getTotalDifficulty(genesis.hash(), new BN(0))
    st.ok(td.eq(genesis.header.difficulty), 'should perform getTotalDifficulty correctly')
    st.end()
  })

  t.test('should save headers', async (st) => {
    const db = level()
    const gasLimit = 8000000

    const genesisBlock = Block.genesis({ header: { gasLimit } })
    let blockchain = new Blockchain({
      db,
      validateBlocks: true,
      validateConsensus: false,
      genesisBlock,
    })

    const headerData = {
      number: 1,
      parentHash: genesisBlock.hash(),
      gasLimit,
      timestamp: genesisBlock.header.timestamp.addn(1),
    }
    const header = BlockHeader.fromHeaderData(headerData, {
      calcDifficultyFromHeader: genesisBlock.header,
    })
    await blockchain.putHeader(header)

    blockchain = new Blockchain({
      db,
      validateBlocks: true,
      validateConsensus: false,
      genesisBlock,
    })

    const latestHeader = await blockchain.getLatestHeader()
    st.ok(latestHeader.hash().equals(header.hash()), 'should save headHeader')

    const latestBlock = await blockchain.getLatestBlock()
    st.ok(latestBlock.hash().equals(genesisBlock.hash()), 'should save headBlock')
    st.end()
  })

  t.test('should get latest', async (st) => {
    const gasLimit = 8000000
    const common = new Common({ chain: 'mainnet', hardfork: 'chainstart' })
    const opts: BlockOptions = { common }

    const genesisBlock = Block.genesis({ header: { gasLimit } }, opts)
    const blockchain = new Blockchain({
      validateBlocks: true,
      validateConsensus: false,
      genesisBlock,
    })

    const blockData = {
      header: {
        number: 1,
        parentHash: genesisBlock.hash(),
        timestamp: genesisBlock.header.timestamp.addn(3),
        gasLimit,
      },
    }
    opts.calcDifficultyFromHeader = genesisBlock.header
    const block = Block.fromBlockData(blockData, opts)

    const headerData1 = {
      number: 1,
      parentHash: genesisBlock.hash(),
      timestamp: genesisBlock.header.timestamp.addn(1),
      gasLimit,
    }
    opts.calcDifficultyFromHeader = genesisBlock.header
    const header1 = BlockHeader.fromHeaderData(headerData1, opts)
    const headers = [header1]

    const headerData2 = {
      number: 2,
      parentHash: header1.hash(),
      timestamp: header1.timestamp.addn(1),
      gasLimit,
    }
    opts.calcDifficultyFromHeader = block.header
    const header2 = BlockHeader.fromHeaderData(headerData2, opts)
    headers.push(header2)

    await blockchain.putHeaders(headers)

    const latestHeader = await blockchain.getLatestHeader()
    st.ok(latestHeader.hash().equals(headers[1].hash()), 'should update latest header')

    const latestBlock = await blockchain.getLatestBlock()
    st.ok(latestBlock.hash().equals(genesisBlock.hash()), 'should not change latest block')

    await blockchain.putBlock(block)

    const latestHeader2 = await blockchain.getLatestHeader()
    st.ok(latestHeader2.hash().equals(headers[1].hash()), 'should not change latest header')

    const getBlock = await blockchain.getLatestBlock()
    st.ok(getBlock!.hash().equals(block.hash()), 'should update latest block')
    st.end()
  })

  t.test('mismatched chains', async (st) => {
    const common = new Common({ chain: 'mainnet', hardfork: 'chainstart' })
    const gasLimit = 8000000

    const genesisBlock = Block.genesis({ header: { gasLimit } }, { common })

    const blockData1 = {
      header: {
        number: 1,
        parentHash: genesisBlock.hash(),
        timestamp: genesisBlock.header.timestamp.addn(1),
        gasLimit,
      },
    }
    const blockData2 = {
      ...blockData1,
      number: 2,
      timestamp: genesisBlock.header.timestamp.addn(2),
    }

    const blocks = [
      genesisBlock,
      Block.fromBlockData(blockData1, { common, calcDifficultyFromHeader: genesisBlock.header }),
      Block.fromBlockData(blockData2, {
        common: new Common({ chain: 'ropsten', hardfork: 'chainstart' }),
        calcDifficultyFromHeader: genesisBlock.header,
      }),
    ]

    const blockchain = new Blockchain({
      common,
      validateBlocks: true,
      validateConsensus: false,
      genesisBlock,
    })

    for (let i = 1; i < blocks.length; i++) {
      let error
      try {
        await blockchain.putBlock(blocks[i])
      } catch (err) {
        error = err
      }
      if (i === 2) {
        st.ok(error.message.match('Chain mismatch'), 'should return chain mismatch error')
      } else {
        st.error(error, 'should not return mismatch error')
      }
    }
    st.end()
  })
})

tape('initialization tests', (t) => {
  t.test('should read genesis from database', async (st) => {
    const common = new Common({
      chain: 'ropsten',
      hardfork: 'chainstart',
    })
    const genesisHash = Block.genesis({}, { common }).hash()
    const blockchain = new Blockchain({ common })

    st.ok(
      (await blockchain.getHead()).hash().equals(genesisHash),
      'head hash should equal expected ropsten genesis hash'
    )

    const db = blockchain.db

    const newBlockchain = new Blockchain({ db, common })

    st.ok(
      (await newBlockchain.getHead()).hash().equals(genesisHash),
      'head hash should be read from the provided db'
    )
    st.end()
  })

  t.test('should allow to put a custom genesis block', async (st) => {
    const genesisBlock = Block.genesis({
      header: {
        extraData: Buffer.from('custom extra data'),
      },
    })
    const hash = genesisBlock.hash()
    const blockchain = new Blockchain({ genesisBlock })
    const db = blockchain.db

    st.ok(
      (await blockchain.getHead()).hash().equals(hash),
      'blockchain should put custom genesis block'
    )

    const newBlockchain = new Blockchain({ db, genesisBlock })
    st.ok(
      (await newBlockchain.getHead()).hash().equals(hash),
      'head hash should be read from the provided db'
    )
    st.end()
  })

  t.test('should not allow to change the genesis block in the database', async (st) => {
    const genesisBlock = Block.genesis({
      header: {
        extraData: Buffer.from('custom extra data'),
      },
    })
    const hash = genesisBlock.hash()
    const blockchain = new Blockchain({ genesisBlock })
    const db = blockchain.db

    const otherGenesisBlock = Block.genesis({
      header: {
        extraData: Buffer.from('other extra data'),
      },
    })

    // assert that this is a block with a new hash
    if (otherGenesisBlock.hash().equals(hash)) {
      st.fail('other genesis block should have a different hash than the genesis block')
    }

    // try to put a new genesis block should throw
    try {
      await blockchain.putBlock(otherGenesisBlock)
      st.fail('putting a genesis block did not throw')
    } catch (e) {
      st.pass('putting a genesis block did throw')
    }

    // trying to input a genesis block which differs from the one in db should throw on creation
    try {
      await Blockchain.create({ genesisBlock: otherGenesisBlock, db })
      st.fail('creating blockchain with different genesis block than in db did not throw')
    } catch (e) {
      st.pass('creating blockchain with different genesis block than in db throws')
    }

    st.end()
  })
})
