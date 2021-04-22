import Common from '@ethereumjs/common'
import { Block } from '@ethereumjs/block'
import { Address, BN } from 'ethereumjs-util'
import tape from 'tape'
import Blockchain from '../src'
import { CLIQUE_NONCE_AUTH } from '../src/clique'
import { generateConsecutiveBlock } from './util'

const genesis = Block.fromBlockData({
  header: {
    number: new BN(0),
    difficulty: new BN(0x020000),
    gasLimit: new BN(8000000),
  },
})

tape('reorg tests', (t) => {
  t.test(
    'should correctly reorg the chain if the total difficulty is higher on a lower block number than the current head block',
    async (st) => {
      const common = new Common({ chain: 'mainnet', hardfork: 'muirGlacier' })
      const blockchain = await Blockchain.create({
        validateBlocks: true,
        validateConsensus: false,
        common,
        genesisBlock: genesis,
      })

      const blocks_lowTD: Block[] = []
      const blocks_highTD: Block[] = []

      blocks_lowTD.push(generateConsecutiveBlock(genesis, 0))

      const TD_Low = genesis.header.difficulty.add(blocks_lowTD[0].header.difficulty)
      const TD_High = genesis.header.difficulty.clone()

      // Keep generating blocks until the Total Difficulty (TD) of the High TD chain is higher than the TD of the Low TD chain
      // This means that the block number of the high TD chain is 1 lower than the low TD chain

      while (TD_High.cmp(TD_Low) == -1) {
        blocks_lowTD.push(generateConsecutiveBlock(blocks_lowTD[blocks_lowTD.length - 1], 0))
        blocks_highTD.push(
          generateConsecutiveBlock(blocks_highTD[blocks_highTD.length - 1] || genesis, 1)
        )

        TD_Low.iadd(blocks_lowTD[blocks_lowTD.length - 1].header.difficulty)
        TD_High.iadd(blocks_highTD[blocks_highTD.length - 1].header.difficulty)
      }

      // sanity check
      const lowTDBlock = blocks_lowTD[blocks_lowTD.length - 1]
      const highTDBlock = blocks_highTD[blocks_highTD.length - 1]

      const number_lowTD = lowTDBlock.header.number
      const number_highTD = highTDBlock.header.number

      // ensure that the block difficulty is higher on the highTD chain when compared to the low TD chain
      t.ok(
        number_lowTD.cmp(number_highTD) == 1,
        'low TD should have a lower TD than the reported high TD'
      )
      t.ok(
        blocks_lowTD[blocks_lowTD.length - 1].header.number.gt(
          blocks_highTD[blocks_highTD.length - 1].header.number
        ),
        'low TD block should have a higher number than high TD block'
      )

      await blockchain.putBlocks(blocks_lowTD)

      const head_lowTD = await blockchain.getHead()

      await blockchain.putBlocks(blocks_highTD)

      const head_highTD = await blockchain.getHead()

      t.ok(
        head_lowTD.hash().equals(lowTDBlock.hash()),
        'head on the low TD chain should equal the low TD block'
      )
      t.ok(
        head_highTD.hash().equals(highTDBlock.hash()),
        'head on the high TD chain should equal the high TD block'
      )

      st.end()
    }
  )

  t.test(
    'should correctly reorg a poa chain and remove blocks from clique snapshots',
    async (st) => {
      const common = new Common({ chain: 'goerli', hardfork: 'chainstart' })
      const genesisBlock = Block.genesis({}, { common })
      const blockchain = await Blockchain.create({
        validateBlocks: false,
        validateConsensus: false,
        common,
        genesisBlock,
      })

      const extraData = Buffer.from(
        '506172697479205465636820417574686f7269747900000000000000000000002bbf886181970654ed46e3fae0ded41ee53fec702c47431988a7ae80e6576f3552684f069af80ba11d36327aaf846d470526e4a1c461601b2fd4ebdcdc2b734a01',
        'hex'
      ) // from goerli block 1
      const { gasLimit } = genesisBlock.header
      const base = { extraData, gasLimit }

      const nonce = CLIQUE_NONCE_AUTH
      const beneficiary1 = new Address(Buffer.alloc(20).fill(1))
      const beneficiary2 = new Address(Buffer.alloc(20).fill(2))

      const block1_low = Block.fromBlockData(
        {
          header: {
            ...base,
            number: 1,
            parentHash: genesisBlock.hash(),
            timestamp: genesisBlock.header.timestamp.addn(30),
          },
        },
        { common }
      )
      const block2_low = Block.fromBlockData(
        {
          header: {
            ...base,
            number: 2,
            parentHash: block1_low.hash(),
            timestamp: block1_low.header.timestamp.addn(30),
            nonce,
            coinbase: beneficiary1,
          },
        },
        { common }
      )

      const block1_high = Block.fromBlockData(
        {
          header: {
            ...base,
            number: 1,
            parentHash: genesisBlock.hash(),
            timestamp: genesisBlock.header.timestamp.addn(15),
          },
        },
        { common }
      )
      const block2_high = Block.fromBlockData(
        {
          header: {
            ...base,
            number: 2,
            parentHash: block1_high.hash(),
            timestamp: block1_high.header.timestamp.addn(15),
            nonce,
            coinbase: beneficiary2,
          },
        },
        { common }
      )

      await blockchain.putBlocks([block1_low, block2_low])
      const head_low = await blockchain.getHead()

      await blockchain.putBlocks([block1_high, block2_high])
      const head_high = await blockchain.getHead()

      t.ok(
        head_low.hash().equals(block2_low.hash()),
        'head on the low chain should equal the low block'
      )
      t.ok(
        head_high.hash().equals(block2_high.hash()),
        'head on the high chain should equal the high block'
      )

      let signerStates = (blockchain as any)._cliqueLatestSignerStates
      t.ok(
        !signerStates.find(
          (s: any) => s[0].eqn(2) && s[1].find((a: Address) => a.equals(beneficiary1))
        ),
        'should not find reorged signer state'
      )

      let signerVotes = (blockchain as any)._cliqueLatestVotes
      t.ok(
        !signerVotes.find(
          (v: any) =>
            v[0].eqn(2) &&
            v[1][0].equals(block1_low.header.cliqueSigner()) &&
            v[1][1].equals(beneficiary1) &&
            v[1][2].equals(CLIQUE_NONCE_AUTH)
        ),
        'should not find reorged clique vote'
      )

      let blockSigners = (blockchain as any)._cliqueLatestBlockSigners
      t.ok(
        !blockSigners.find(
          (s: any) => s[0].eqn(1) && s[1].equals(block1_low.header.cliqueSigner())
        ),
        'should not find reorged block signer'
      )

      signerStates = (blockchain as any)._cliqueLatestSignerStates
      t.ok(
        !!signerStates.find(
          (s: any) => s[0].eqn(2) && s[1].find((a: Address) => a.equals(beneficiary2))
        ),
        'should find reorged signer state'
      )

      signerVotes = (blockchain as any)._cliqueLatestVotes
      t.ok(signerVotes.length == 0, 'votes should be empty')

      blockSigners = (blockchain as any)._cliqueLatestBlockSigners
      t.ok(
        !!blockSigners.find(
          (s: any) => s[0].eqn(2) && s[1].equals(block2_high.header.cliqueSigner())
        ),
        'should find reorged block signer'
      )
      st.end()
    }
  )
})
