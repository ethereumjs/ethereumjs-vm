import { Block } from '@ethereumjs/block'
import Common from '@ethereumjs/common'
import { Address, BN } from 'ethereumjs-util'
import tape from 'tape'
import Blockchain from '../src'
import { CLIQUE_NONCE_AUTH, CLIQUE_NONCE_DROP } from '../src/clique'

tape('Clique: Initialization', (t) => {
  t.test('should initialize a clique blockchain', async (st) => {
    const common = new Common({ chain: 'rinkeby', hardfork: 'chainstart' })
    const blockchain = await Blockchain.create({ common })

    const head = await blockchain.getHead()
    st.equals(head.hash().toString('hex'), common.genesis().hash.slice(2), 'correct genesis hash')

    st.deepEquals(
      blockchain.cliqueActiveSigners(),
      head.header.cliqueEpochTransitionSigners(),
      'correct genesis signers'
    )
    st.end()
  })

  const COMMON = new Common({ chain: 'rinkeby', hardfork: 'chainstart' })
  const EXTRA_DATA = Buffer.alloc(97)
  const GAS_LIMIT = 8000000

  type Signer = {
    address: Address
    privateKey: Buffer
    publicKey: Buffer
  }

  const A: Signer = {
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

  const B: Signer = {
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

  const C: Signer = {
    address: new Address(Buffer.from('83c30730d1972baa09765a1ac72a43db27fedce5', 'hex')),
    privateKey: Buffer.from(
      'f216ddcf276079043c52b5dd144aa073e6b272ad4bfeaf4fbbc044aa478d1927',
      'hex'
    ),
    publicKey: Buffer.from(
      '555b19a5cbe6dd082a4a1e1e0520dd52a82ba24fd5598ea31f0f31666c40905ed319314c5fb06d887b760229e1c0e616294e7b1cb5dfefb71507c9112132ce56',
      'hex'
    ),
  }

  const D: Signer = {
    address: new Address(Buffer.from('8458f408106c4875c96679f3f556a511beabe138', 'hex')),
    privateKey: Buffer.from(
      '159e95d07a6c64ddbafa6036cdb7b8114e6e8cdc449ca4b0468a6d0c955f991b',
      'hex'
    ),
    publicKey: Buffer.from(
      'f02724341e2df54cf53515f079b1354fa8d437e79c5b091b8d8cc7cbcca00fd8ad854cb3b3a85b06c44ecb7269404a67be88b561f2224c94d133e5fc21be915c',
      'hex'
    ),
  }

  const E: Signer = {
    address: new Address(Buffer.from('ab80a948c661aa32d09952d2a6c4ad77a4c947be', 'hex')),
    privateKey: Buffer.from(
      '48ec5a6c4a7fc67b10a9d4c8a8f594a81ae42e41ed061fa5218d96abb6012344',
      'hex'
    ),
    publicKey: Buffer.from(
      'adefb82b9f54e80aa3532263e4478739de16fcca6828f4ae842f8a07941c347fa59d2da1300569237009f0f122dc1fd6abb0db8fcb534280aa94948a5cc95f94',
      'hex'
    ),
  }

  const F: Signer = {
    address: new Address(Buffer.from('dc7bc81ddf67d037d7439f8e6ff12f3d2a100f71', 'hex')),
    privateKey: Buffer.from(
      '86b0ff7b6cf70786f29f297c57562905ab0b6c32d69e177a46491e56da9e486e',
      'hex'
    ),
    publicKey: Buffer.from(
      'd3e3d2b722e325bfc085ff5638a112b4e7e88ff13f92fc7f6cfc14b5a25e8d1545a2f27d8537b96e8919949d5f8c139ae7fc81aea7cf7fe5d43d7faaa038e35b',
      'hex'
    ),
  }

  const initWithSigners = async (signers: Signer[], common?: Common) => {
    common = common ?? COMMON
    const blocks: Block[] = []

    const extraData = Buffer.concat([
      Buffer.alloc(32),
      ...signers.map((s) => s.address.toBuffer()),
      Buffer.alloc(65),
    ])
    const genesisBlock = Block.genesis({ header: { gasLimit: GAS_LIMIT, extraData } }, { common })
    blocks.push(genesisBlock)

    const blockchain = await Blockchain.create({
      validateBlocks: true,
      validateConsensus: true,
      genesisBlock,
      common,
    })
    return { blocks, blockchain }
  }

  const addNextBlock = async (
    blockchain: Blockchain,
    blocks: Block[],
    signer: Signer,
    beneficiary?: [Signer, boolean],
    checkpointSigners?: Signer[],
    common?: Common
  ) => {
    common = common ?? COMMON
    const number = blocks.length
    const lastBlock = blocks[number - 1]

    let coinbase = Address.zero()
    let nonce = CLIQUE_NONCE_DROP
    let extraData = EXTRA_DATA
    if (beneficiary) {
      coinbase = beneficiary[0].address
      if (beneficiary[1]) {
        nonce = CLIQUE_NONCE_AUTH
      }
    } else if (checkpointSigners) {
      extraData = Buffer.concat([
        Buffer.alloc(32),
        ...checkpointSigners.map((s) => s.address.toBuffer()),
        Buffer.alloc(65),
      ])
    }

    const blockData = {
      header: {
        number,
        parentHash: lastBlock.hash(),
        coinbase,
        timestamp: lastBlock.header.timestamp.addn(15),
        extraData,
        gasLimit: GAS_LIMIT,
        difficulty: new BN(2),
        nonce,
      },
    }

    // calculate difficulty
    const signers = blockchain.cliqueActiveSigners()
    const signerIndex = signers.findIndex((address: Address) => address.equals(signer.address))
    const inTurn = number % signers.length === signerIndex
    blockData.header.difficulty = inTurn ? new BN(2) : new BN(1)

    // set signer
    const cliqueSigner = signer.privateKey

    const block = Block.fromBlockData(blockData, { common, freeze: false, cliqueSigner })

    await blockchain.putBlock(block)
    blocks.push(block)
    return block
  }

  t.test('should throw if signer in epoch checkpoint is not active', async (st) => {
    const { blockchain } = await initWithSigners([A])
    ;(blockchain as any)._validateBlocks = false
    ;(blockchain as any)._validateConsensus = false
    const number = COMMON.consensusConfig().epoch
    const unauthorizedSigner = Address.fromString('0x00a839de7922491683f547a67795204763ff8237')
    const extraData = Buffer.concat([
      Buffer.alloc(32),
      A.address.toBuffer(),
      unauthorizedSigner.toBuffer(),
      Buffer.alloc(65),
    ])
    const block = Block.fromBlockData({ header: { number, extraData } }, { common: COMMON })
    try {
      await blockchain.putBlock(block)
      st.fail('should fail')
    } catch (error) {
      if (error.message.includes('checkpoint signer not found in active signers list')) {
        st.pass('correct error')
      } else {
        st.fail('should fail with appropriate error')
      }
    }
    st.end()
  })

  t.test('should throw on invalid difficulty', async (st) => {
    const { blocks, blockchain } = await initWithSigners([A])
    await addNextBlock(blockchain, blocks, A)
    ;(blockchain as any)._validateBlocks = false

    const number = new BN(1)
    const extraData = Buffer.alloc(97)
    let difficulty = new BN(5)
    let block = Block.fromBlockData(
      { header: { number, extraData, difficulty } },
      { common: COMMON }
    )

    try {
      await block.validate(blockchain)
      st.fail('should fail')
    } catch (error) {
      if (error.message.includes('difficulty for clique block must be INTURN (2) or NOTURN (1)')) {
        st.pass('correct error')
      } else {
        st.fail('should fail with appropriate error')
      }
    }

    difficulty = new BN(1)
    const cliqueSigner = A.privateKey
    block = Block.fromBlockData(
      { header: { number, extraData, difficulty } },
      { common: COMMON, cliqueSigner }
    )

    try {
      await block.validate(blockchain)
      st.fail('should fail')
    } catch (error) {
      if (error.message.includes('invalid clique difficulty')) {
        st.pass('correct error')
      } else {
        st.fail('should fail with appropriate error')
      }
    }

    st.end()
  })

  // Test Cases: https://eips.ethereum.org/EIPS/eip-225
  t.test('Clique Voting: Single signer, no votes cast', async (st) => {
    const { blocks, blockchain } = await initWithSigners([A])
    const block = await addNextBlock(blockchain, blocks, A)
    st.equal(block.header.number.toNumber(), 1)
    st.deepEqual(blockchain.cliqueActiveSigners(), [A.address])
    st.end()
  })

  t.test('Clique Voting: Single signer, voting to add two others', async (st) => {
    const { blocks, blockchain } = await initWithSigners([A])
    await addNextBlock(blockchain, blocks, A, [B, true])
    await addNextBlock(blockchain, blocks, B)
    await addNextBlock(blockchain, blocks, A, [C, true])
    st.deepEqual(
      blockchain.cliqueActiveSigners(),
      [A.address, B.address],
      'only accept first, second needs 2 votes'
    )
    st.end()
  })

  t.test('Two signers, voting to add three others', async (st) => {
    const { blocks, blockchain } = await initWithSigners([A, B])
    await addNextBlock(blockchain, blocks, A, [C, true])
    await addNextBlock(blockchain, blocks, B, [C, true])
    await addNextBlock(blockchain, blocks, A, [D, true])
    await addNextBlock(blockchain, blocks, B, [D, true])
    await addNextBlock(blockchain, blocks, C)
    await addNextBlock(blockchain, blocks, A, [E, true])
    await addNextBlock(blockchain, blocks, B, [E, true])

    st.deepEqual(
      blockchain.cliqueActiveSigners(),
      [A.address, B.address, C.address, D.address],
      'only accept first two, third needs 3 votes already'
    )
    st.end()
  })

  t.test('Clique Voting: Single signer, dropping itself)', async (st) => {
    const { blocks, blockchain } = await initWithSigners([A])
    await addNextBlock(blockchain, blocks, A, [A, false])

    st.deepEqual(
      blockchain.cliqueActiveSigners(),
      [],
      'weird, but one less cornercase by explicitly allowing this'
    )
    st.end()
  })

  t.test(
    'Clique Voting: Two signers, actually needing mutual consent to drop either of them',
    async (st) => {
      const { blocks, blockchain } = await initWithSigners([A, B])
      await addNextBlock(blockchain, blocks, A, [B, false])

      st.deepEqual(blockchain.cliqueActiveSigners(), [A.address, B.address], 'not fulfilled')
      st.end()
    }
  )

  t.test(
    'Clique Voting: Two signers, actually needing mutual consent to drop either of them',
    async (st) => {
      const { blocks, blockchain } = await initWithSigners([A, B])
      await addNextBlock(blockchain, blocks, A, [B, false])
      await addNextBlock(blockchain, blocks, B, [B, false])

      st.deepEqual(blockchain.cliqueActiveSigners(), [A.address], 'fulfilled')
      st.end()
    }
  )

  t.test('Clique Voting: Three signers, two of them deciding to drop the third', async (st) => {
    const { blocks, blockchain } = await initWithSigners([A, B, C])
    await addNextBlock(blockchain, blocks, A, [C, false])
    await addNextBlock(blockchain, blocks, B, [C, false])

    st.deepEqual(blockchain.cliqueActiveSigners(), [A.address, B.address])
    st.end()
  })

  t.test(
    'Clique Voting: Four signers, consensus of two not being enough to drop anyone',
    async (st) => {
      const { blocks, blockchain } = await initWithSigners([A, B, C, D])
      await addNextBlock(blockchain, blocks, A, [C, false])
      await addNextBlock(blockchain, blocks, B, [C, false])

      st.deepEqual(blockchain.cliqueActiveSigners(), [A.address, B.address, C.address, D.address])
      st.end()
    }
  )

  t.test(
    'Clique Voting: Four signers, consensus of three already being enough to drop someone',
    async (st) => {
      const { blocks, blockchain } = await initWithSigners([A, B, C, D])
      await addNextBlock(blockchain, blocks, A, [D, false])
      await addNextBlock(blockchain, blocks, B, [D, false])
      await addNextBlock(blockchain, blocks, C, [D, false])

      st.deepEqual(blockchain.cliqueActiveSigners(), [A.address, B.address, C.address])
      st.end()
    }
  )

  t.test('Clique Voting: Authorizations are counted once per signer per target', async (st) => {
    const { blocks, blockchain } = await initWithSigners([A, B])
    await addNextBlock(blockchain, blocks, A, [C, true])
    await addNextBlock(blockchain, blocks, B)
    await addNextBlock(blockchain, blocks, A, [C, true])
    await addNextBlock(blockchain, blocks, B)
    await addNextBlock(blockchain, blocks, A, [C, true])

    st.deepEqual(blockchain.cliqueActiveSigners(), [A.address, B.address])
    st.end()
  })

  t.test('Clique Voting: Authorizing multiple accounts concurrently is permitted', async (st) => {
    const { blocks, blockchain } = await initWithSigners([A, B])
    await addNextBlock(blockchain, blocks, A, [C, true])
    await addNextBlock(blockchain, blocks, B)
    await addNextBlock(blockchain, blocks, A, [D, true])
    await addNextBlock(blockchain, blocks, B)
    await addNextBlock(blockchain, blocks, A)
    await addNextBlock(blockchain, blocks, B, [D, true])
    await addNextBlock(blockchain, blocks, A)
    await addNextBlock(blockchain, blocks, B, [C, true])

    st.deepEqual(blockchain.cliqueActiveSigners(), [A.address, B.address, C.address, D.address])
    st.end()
  })

  t.test('Clique Voting: Deauthorizations are counted once per signer per target', async (st) => {
    const { blocks, blockchain } = await initWithSigners([A, B])
    await addNextBlock(blockchain, blocks, A, [B, false])
    await addNextBlock(blockchain, blocks, B)
    await addNextBlock(blockchain, blocks, A, [B, false])
    await addNextBlock(blockchain, blocks, B)
    await addNextBlock(blockchain, blocks, A, [B, false])

    st.deepEqual(blockchain.cliqueActiveSigners(), [A.address, B.address])
    st.end()
  })

  t.test('Clique Voting: Deauthorizing multiple accounts concurrently is permitted', async (st) => {
    const { blocks, blockchain } = await initWithSigners([A, B, C, D])
    await addNextBlock(blockchain, blocks, A, [C, false])
    await addNextBlock(blockchain, blocks, B)
    await addNextBlock(blockchain, blocks, C)
    await addNextBlock(blockchain, blocks, A, [D, false])
    await addNextBlock(blockchain, blocks, B)
    await addNextBlock(blockchain, blocks, C)
    await addNextBlock(blockchain, blocks, A)
    await addNextBlock(blockchain, blocks, B, [D, false])
    await addNextBlock(blockchain, blocks, C, [D, false])
    await addNextBlock(blockchain, blocks, A)
    await addNextBlock(blockchain, blocks, B, [C, false])

    st.deepEqual(blockchain.cliqueActiveSigners(), [A.address, B.address])
    st.end()
  })

  t.test('Clique Voting: Votes from deauthorized signers are discarded immediately', async (st) => {
    const { blocks, blockchain } = await initWithSigners([A, B, C])
    await addNextBlock(blockchain, blocks, C, [B, false])
    await addNextBlock(blockchain, blocks, A, [C, false])
    await addNextBlock(blockchain, blocks, B, [C, false])
    await addNextBlock(blockchain, blocks, A, [B, false])

    st.deepEqual(blockchain.cliqueActiveSigners(), [A.address, B.address], 'deauth votes')
    st.end()
  })

  t.test('Clique Voting: Votes from deauthorized signers are discarded immediately', async (st) => {
    const { blocks, blockchain } = await initWithSigners([A, B, C])
    await addNextBlock(blockchain, blocks, C, [D, true])
    await addNextBlock(blockchain, blocks, A, [C, false])
    await addNextBlock(blockchain, blocks, B, [C, false])
    await addNextBlock(blockchain, blocks, A, [D, true])

    st.deepEqual(blockchain.cliqueActiveSigners(), [A.address, B.address], 'auth votes')
    st.end()
  })

  t.test(
    'Clique Voting: Changes reaching consensus out of bounds (via a deauth) execute on touch',
    async (st) => {
      const { blocks, blockchain } = await initWithSigners([A, B, C, D])
      await addNextBlock(blockchain, blocks, A, [C, false])
      await addNextBlock(blockchain, blocks, B)
      await addNextBlock(blockchain, blocks, C)
      await addNextBlock(blockchain, blocks, A, [D, false])
      await addNextBlock(blockchain, blocks, B, [C, false])
      await addNextBlock(blockchain, blocks, C)
      await addNextBlock(blockchain, blocks, A)
      await addNextBlock(blockchain, blocks, B, [D, false])
      await addNextBlock(blockchain, blocks, C, [D, false])
      await addNextBlock(blockchain, blocks, A)
      await addNextBlock(blockchain, blocks, C, [C, true])

      st.deepEqual(blockchain.cliqueActiveSigners(), [A.address, B.address])
      st.end()
    }
  )

  t.test(
    'Clique Voting: Changes reaching consensus out of bounds (via a deauth) may go out of consensus on first touch',
    async (st) => {
      const { blocks, blockchain } = await initWithSigners([A, B, C, D])
      await addNextBlock(blockchain, blocks, A, [C, false])
      await addNextBlock(blockchain, blocks, B)
      await addNextBlock(blockchain, blocks, C)
      await addNextBlock(blockchain, blocks, A, [D, false])
      await addNextBlock(blockchain, blocks, B, [C, false])
      await addNextBlock(blockchain, blocks, C)
      await addNextBlock(blockchain, blocks, A)
      await addNextBlock(blockchain, blocks, B, [D, false])
      await addNextBlock(blockchain, blocks, C, [D, false])
      await addNextBlock(blockchain, blocks, A)
      await addNextBlock(blockchain, blocks, B, [C, true])

      st.deepEqual(blockchain.cliqueActiveSigners(), [A.address, B.address, C.address])
      st.end()
    }
  )

  t.test(
    "Clique Voting: Ensure that pending votes don't survive authorization status changes",
    async (st) => {
      // This corner case can only appear if a signer is quickly added, removed
      // and then readded (or the inverse), while one of the original voters
      // dropped. If a past vote is left cached in the system somewhere, this
      // will interfere with the final signer outcome.
      const { blocks, blockchain } = await initWithSigners([A, B, C, D, E])
      await addNextBlock(blockchain, blocks, A, [F, true]) // Authorize F, 3 votes needed
      await addNextBlock(blockchain, blocks, B, [F, true])
      await addNextBlock(blockchain, blocks, C, [F, true])
      await addNextBlock(blockchain, blocks, D, [F, false]) // Deauthorize F, 4 votes needed (leave A's previous vote "unchanged")
      await addNextBlock(blockchain, blocks, E, [F, false])
      await addNextBlock(blockchain, blocks, B, [F, false])
      await addNextBlock(blockchain, blocks, C, [F, false])
      await addNextBlock(blockchain, blocks, D, [F, true]) // Almost authorize F, 2/3 votes needed
      await addNextBlock(blockchain, blocks, E, [F, true])
      await addNextBlock(blockchain, blocks, B, [A, false]) // Deauthorize A, 3 votes needed
      await addNextBlock(blockchain, blocks, C, [A, false])
      await addNextBlock(blockchain, blocks, D, [A, false])
      await addNextBlock(blockchain, blocks, B, [F, true]) // Finish authorizing F, 3/3 votes needed

      st.deepEqual(blockchain.cliqueActiveSigners(), [
        B.address,
        C.address,
        D.address,
        E.address,
        F.address,
      ])
      st.end()
    }
  )

  t.test(
    'Clique Voting: Epoch transitions reset all votes to allow chain checkpointing',
    async (st) => {
      const common = Common.forCustomChain(
        'rinkeby',
        {
          consensus: {
            type: 'poa',
            algorithm: 'clique',
            clique: {
              period: 15,
              epoch: 3,
            },
          },
        },
        'chainstart'
      )
      const { blocks, blockchain } = await initWithSigners([A, B], common)
      await addNextBlock(blockchain, blocks, A, [C, true], undefined, common)
      await addNextBlock(blockchain, blocks, B, undefined, undefined, common)
      await addNextBlock(blockchain, blocks, A, undefined, [A, B], common)
      await addNextBlock(blockchain, blocks, B, [C, true], undefined, common)

      st.deepEqual(blockchain.cliqueActiveSigners(), [A.address, B.address])
      st.end()
    }
  )

  t.test('Clique Voting: An unauthorized signer should not be able to sign blocks', async (st) => {
    const { blocks, blockchain } = await initWithSigners([A])
    await addNextBlock(blockchain, blocks, A)
    try {
      await addNextBlock(blockchain, blocks, B)
      st.fail('should throw error')
    } catch (error) {
      if (error.message.includes('invalid PoA block signature (clique)')) {
        st.pass('correct error thrown')
      } else {
        st.fail('correct error not thrown')
      }
    }
    st.end()
  })

  t.test(
    'Clique Voting: An authorized signer that signed recenty should not be able to sign again',
    async (st) => {
      const { blocks, blockchain } = await initWithSigners([A, B])
      await addNextBlock(blockchain, blocks, A)
      try {
        await addNextBlock(blockchain, blocks, A)
        st.fail('should throw error')
      } catch (error) {
        if (error.message.includes('recently signed')) {
          st.pass('correct error thrown')
        } else {
          st.fail('correct error not thrown')
        }
      }
      st.end()
    }
  )

  t.test(
    'Clique Voting: Recent signatures should not reset on checkpoint blocks imported in a batch',
    async (st) => {
      const common = Common.forCustomChain(
        'rinkeby',
        {
          consensus: {
            type: 'poa',
            algorithm: 'clique',
            clique: {
              period: 15,
              epoch: 3,
            },
          },
        },
        'chainstart'
      )
      const { blocks, blockchain } = await initWithSigners([A, B, C], common)
      await addNextBlock(blockchain, blocks, A, undefined, undefined, common)
      await addNextBlock(blockchain, blocks, B, undefined, undefined, common)
      await addNextBlock(blockchain, blocks, A, undefined, [A, B, C], common)
      try {
        await addNextBlock(blockchain, blocks, A, undefined, undefined, common)
        st.fail('should throw error')
      } catch (error) {
        if (error.message.includes('recently signed')) {
          st.pass('correct error thrown')
        } else {
          st.fail('correct error not thrown')
        }
      }
      st.end()
    }
  )
})
