import { BN, rlp } from 'ethereumjs-util'
import { Block, BlockHeader } from '@ethereumjs/block'
import Common from '@ethereumjs/common'
import Blockchain from '../src'
const level = require('level-mem')

export const generateBlocks = (numberOfBlocks: number, existingBlocks?: Block[]): Block[] => {
  const blocks = existingBlocks ? existingBlocks : []

  const gasLimit = 8000000
  const common = new Common({ chain: 'mainnet', hardfork: 'chainstart' })
  const opts = { common }

  if (blocks.length === 0) {
    const genesis = Block.genesis({ header: { gasLimit } }, opts)
    blocks.push(genesis)
  }

  for (let i = blocks.length; i < numberOfBlocks; i++) {
    const lastBlock = blocks[i - 1]
    const blockData = {
      header: {
        number: i,
        parentHash: lastBlock.hash(),
        gasLimit,
        timestamp: lastBlock.header.timestamp.addn(1),
      },
    }
    const block = Block.fromBlockData(blockData, {
      common,
      calcDifficultyFromHeader: lastBlock.header,
    })
    blocks.push(block)
  }

  return blocks
}

export const generateBlockchain = async (numberOfBlocks: number, genesis?: Block): Promise<any> => {
  const existingBlocks: Block[] = genesis ? [genesis] : []
  const blocks = generateBlocks(numberOfBlocks, existingBlocks)

  const blockchain = await Blockchain.create({
    validateBlocks: true,
    validateConsensus: false,
    genesisBlock: genesis || blocks[0],
  })
  try {
    await blockchain.putBlocks(blocks.slice(1))
  } catch (error) {
    return { error }
  }

  return {
    blockchain,
    blocks,
    error: null,
  }
}
/**
 *
 * @param parentBlock parent block to generate the consecutive block on top of
 * @param difficultyChangeFactor this integer can be any value, but will only return unique blocks between [-99, 1] (this is due to difficulty calculation). 1 will increase the difficulty, 0 will keep the difficulty constant any any negative number will decrease the difficulty
 */

export const generateConsecutiveBlock = (
  parentBlock: Block,
  difficultyChangeFactor: number
): Block => {
  if (difficultyChangeFactor > 1) {
    difficultyChangeFactor = 1
  }
  const common = new Common({ chain: 'mainnet', hardfork: 'muirGlacier' })
  const tmpHeader = BlockHeader.fromHeaderData({
    number: parentBlock.header.number.addn(1),
    timestamp: parentBlock.header.timestamp.addn(10 + -difficultyChangeFactor * 9),
  })
  const header = BlockHeader.fromHeaderData(
    {
      number: parentBlock.header.number.addn(1),
      parentHash: parentBlock.hash(),
      gasLimit: new BN(8000000),
      timestamp: parentBlock.header.timestamp.addn(10 + -difficultyChangeFactor * 9),
      difficulty: tmpHeader.canonicalDifficulty(parentBlock.header),
    },
    {
      common,
      calcDifficultyFromHeader: parentBlock.header,
    }
  )

  const block = new Block(header, undefined, undefined, { common })

  return block
}

export const isConsecutive = (blocks: Block[]) => {
  return !blocks.some((block: Block, index: number) => {
    if (index === 0) {
      return false
    }
    const { parentHash } = block.header
    const lastBlockHash = blocks[index - 1].hash()
    return !parentHash.equals(lastBlockHash)
  })
}

export const createTestDB = async () => {
  const genesis = Block.genesis()
  const db = level()
  await db.batch([
    {
      type: 'put',
      key: Buffer.from('6800000000000000006e', 'hex'),
      keyEncoding: 'binary',
      valueEncoding: 'binary',
      value: genesis.hash(),
    },
    {
      type: 'put',
      key: Buffer.from('48d4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3', 'hex'),
      keyEncoding: 'binary',
      valueEncoding: 'binary',
      value: Buffer.from('00', 'hex'),
    },
    {
      type: 'put',
      key: 'LastHeader',
      keyEncoding: 'binary',
      valueEncoding: 'binary',
      value: genesis.hash(),
    },
    {
      type: 'put',
      key: 'LastBlock',
      keyEncoding: 'binary',
      valueEncoding: 'binary',
      value: genesis.hash(),
    },
    {
      type: 'put',
      key: Buffer.from(
        '680000000000000000d4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3',
        'hex'
      ),
      keyEncoding: 'binary',
      valueEncoding: 'binary',
      value: genesis.header.serialize(),
    },
    {
      type: 'put',
      key: Buffer.from(
        '680000000000000000d4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa374',
        'hex'
      ),
      keyEncoding: 'binary',
      valueEncoding: 'binary',
      value: rlp.encode(new BN(17179869184).toBuffer()),
    },
    {
      type: 'put',
      key: Buffer.from(
        '620000000000000000d4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3',
        'hex'
      ),
      keyEncoding: 'binary',
      valueEncoding: 'binary',
      value: rlp.encode(genesis.raw().slice(1)),
    },
    {
      type: 'put',
      key: 'heads',
      valueEncoding: 'json',
      value: { head0: { type: 'Buffer', data: [171, 205] } },
    },
  ])
  return [db, genesis]
}
