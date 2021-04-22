import { debug as createDebugLogger } from 'debug'
import Semaphore from 'semaphore-async-await'
import { Address, BN, rlp } from 'ethereumjs-util'
import { Block, BlockData, BlockHeader } from '@ethereumjs/block'
import Ethash from '@ethereumjs/ethash'
import Common from '@ethereumjs/common'
import { DBManager } from './db/manager'
import { DBOp, DBSetBlockOrHeader, DBSetTD, DBSetHashToNumber, DBSaveLookups } from './db/helpers'
import { DBTarget } from './db/operation'
import {
  CliqueSignerState,
  CliqueLatestSignerStates,
  CliqueVote,
  CliqueLatestVotes,
  CliqueBlockSigner,
  CliqueLatestBlockSigners,
  CLIQUE_NONCE_AUTH,
  CLIQUE_NONCE_DROP,
} from './clique'
import type { LevelUp } from 'levelup'
import type { BlockchainInterface, BlockchainOptions, OnBlock } from './types'
const level = require('level-mem')

const debug = createDebugLogger('blockchain:clique')

// Export types to not introduce any
// breaking changes prior to v5.2.1
export { BlockchainInterface, BlockchainOptions }

/**
 * This class stores and interacts with blocks.
 */
export default class Blockchain implements BlockchainInterface {
  db: LevelUp
  dbManager: DBManager
  _ethash?: Ethash
  protected _isInitialized: boolean = false
  private _lock: Semaphore
  private _common: Common

  private _genesis?: Buffer // the genesis hash of this blockchain

  // The following two heads and the heads stored within the `_heads` always point
  // to a hash in the canonical chain and never to a stale hash.
  // With the exception of `_headHeaderHash` this does not necessarily need to be
  // the hash with the highest total difficulty.
  private _headBlockHash?: Buffer // the hash of the current head block
  private _headHeaderHash?: Buffer // the hash of the current head header

  // A Map which stores the head of each key (for instance the "vm" key) which is
  // updated along an `iterator()` method run and can be used to (re)run
  // non-verified blocks (for instance in the VM).
  private _heads: { [key: string]: Buffer }

  private readonly _validateConsensus: boolean
  private readonly _validateBlocks: boolean

  /**
   * Keep signer history data (signer states and votes)
   * for all block numbers >= HEAD_BLOCK - CLIQUE_SIGNER_HISTORY_BLOCK_LIMIT
   *
   * This defines a limit for reorgs on PoA clique chains.
   */
  private CLIQUE_SIGNER_HISTORY_BLOCK_LIMIT = 100

  /**
   * List with the latest signer states checkpointed on blocks where
   * a change (added new or removed a signer) occurred.
   *
   * Format:
   * [ [BLOCK_NUMBER_1, [SIGNER1, SIGNER 2,]], [BLOCK_NUMBER2, [SIGNER1, SIGNER3]], ...]
   *
   * The top element from the array represents the list of current signers.
   * On reorgs elements from the array are removed until BLOCK_NUMBER > REORG_BLOCK.
   *
   * Always keep at least one item on the stack.
   */
  private _cliqueLatestSignerStates: CliqueLatestSignerStates = []

  /**
   * List with the latest signer votes.
   *
   * Format:
   * [ [BLOCK_NUMBER_1, [SIGNER, BENEFICIARY, AUTH]], [BLOCK_NUMBER_1, [SIGNER, BENEFICIARY, AUTH]] ]
   * where AUTH = CLIQUE_NONCE_AUTH | CLIQUE_NONCE_DROP
   *
   * For votes all elements here must be taken into account with a
   * block number >= LAST_EPOCH_BLOCK
   * (nevertheless keep entries with blocks before EPOCH_BLOCK in case a reorg happens
   * during an epoch change)
   *
   * On reorgs elements from the array are removed until BLOCK_NUMBER > REORG_BLOCK.
   */
  private _cliqueLatestVotes: CliqueLatestVotes = []

  /**
   * List of signers for the last consecutive `this.cliqueSignerLimit()` blocks.
   * Kept as a snapshot for quickly checking for "recently signed" error.
   * Format: [ [BLOCK_NUMBER, SIGNER_ADDRESS], ...]
   *
   * On reorgs elements from the array are removed until BLOCK_NUMBER > REORG_BLOCK.
   */
  private _cliqueLatestBlockSigners: CliqueLatestBlockSigners = []

  /**
   * Safe creation of a new Blockchain object awaiting the initialization function,
   * encouraged method to use when creating a blockchain object.
   *
   * @param opts Constructor options, see [[BlockchainOptions]]
   */

  public static async create(opts: BlockchainOptions = {}) {
    const blockchain = new Blockchain(opts)
    await blockchain._init(opts.genesisBlock)
    return blockchain
  }

  /**
   * Creates a blockchain from a list of block objects,
   * objects must be readable by the `Block.fromBlockData()` method
   *
   * @param blockData List of block objects
   * @param opts Constructor options, see [[BlockchainOptions]]
   */
  public static async fromBlocksData(blocksData: BlockData[], opts: BlockchainOptions = {}) {
    const blockchain = await Blockchain.create(opts)
    for (const blockData of blocksData) {
      const block = Block.fromBlockData(blockData, {
        common: blockchain._common,
        hardforkByBlockNumber: true,
      })
      await blockchain.putBlock(block)
    }
    return blockchain
  }

  /**
   * Creates new Blockchain object. This constructor is private, please use [[Blockchain.create]] for safe async creation.
   *
   * @param opts - An object with the options that this constructor takes. See
   * [[BlockchainOptions]].
   */
  private constructor(opts: BlockchainOptions = {}) {
    // Throw on chain or hardfork options removed in latest major release to
    // prevent implicit chain setup on a wrong chain
    if ('chain' in opts || 'hardfork' in opts) {
      throw new Error('Chain/hardfork options are not allowed any more on initialization')
    }

    if (opts.common) {
      this._common = opts.common
    } else {
      const DEFAULT_CHAIN = 'mainnet'
      const DEFAULT_HARDFORK = 'chainstart'
      this._common = new Common({
        chain: DEFAULT_CHAIN,
        hardfork: DEFAULT_HARDFORK,
      })
    }

    this._validateConsensus = opts.validateConsensus ?? true
    this._validateBlocks = opts.validateBlocks ?? true

    this.db = opts.db ? opts.db : level()
    this.dbManager = new DBManager(this.db, this._common)

    if (this._validateConsensus) {
      if (this._common.consensusType() === 'pow') {
        if (this._common.consensusAlgorithm() !== 'ethash') {
          throw new Error('consensus validation only supported for pow ethash algorithm')
        } else {
          this._ethash = new Ethash(this.db)
        }
      }
      if (this._common.consensusType() === 'poa') {
        if (this._common.consensusAlgorithm() !== 'clique') {
          throw new Error(
            'consensus (signature) validation only supported for poa clique algorithm'
          )
        }
      }
    }

    this._heads = {}

    this._lock = new Semaphore(1)

    if (opts.genesisBlock && !opts.genesisBlock.isGenesis()) {
      throw 'supplied block is not a genesis block'
    }
  }

  /**
   * Returns an object with metadata about the Blockchain. It's defined for
   * backwards compatibility.
   */
  get meta() {
    return {
      rawHead: this._headHeaderHash,
      heads: this._heads,
      genesis: this._genesis,
    }
  }

  /**
   * This method is called in [[Blockchain.create]] and either sets up the DB or reads
   * values from the DB and makes these available to the consumers of
   * Blockchain.
   *
   * @hidden
   */
  private async _init(genesisBlock?: Block): Promise<void> {
    if (this._isInitialized) {
      return
    }

    let dbGenesisBlock
    try {
      const genesisHash = await this.dbManager.numberToHash(new BN(0))
      dbGenesisBlock = await this.dbManager.getBlock(genesisHash)
    } catch (error) {
      if (error.type !== 'NotFoundError') {
        throw error
      }
    }

    if (!genesisBlock) {
      const common = this._common.copy()
      common.setHardfork('chainstart')
      genesisBlock = Block.genesis({}, { common })
    }

    // If the DB has a genesis block, then verify that the genesis block in the
    // DB is indeed the Genesis block generated or assigned.
    if (dbGenesisBlock && !genesisBlock.hash().equals(dbGenesisBlock.hash())) {
      throw new Error(
        'The genesis block in the DB has a different hash than the provided genesis block.'
      )
    }

    const genesisHash = genesisBlock.hash()

    if (!dbGenesisBlock) {
      // If there is no genesis block put the genesis block in the DB.
      // For that TD, the BlockOrHeader, and the Lookups have to be saved.
      const dbOps: DBOp[] = []
      dbOps.push(DBSetTD(genesisBlock.header.difficulty.clone(), new BN(0), genesisHash))
      DBSetBlockOrHeader(genesisBlock).map((op) => dbOps.push(op))
      DBSaveLookups(genesisHash, new BN(0)).map((op) => dbOps.push(op))

      await this.dbManager.batch(dbOps)

      if (this._common.consensusAlgorithm() === 'clique') {
        await this.cliqueSaveGenesisSigners(genesisBlock)
      }
    }

    // Clique: read current signer states, signer votes, and block signers
    if (this._common.consensusAlgorithm() === 'clique') {
      this._cliqueLatestSignerStates = await this.dbManager.getCliqueLatestSignerStates()
      this._cliqueLatestVotes = await this.dbManager.getCliqueLatestVotes()
      this._cliqueLatestBlockSigners = await this.dbManager.getCliqueLatestBlockSigners()
    }

    // At this point, we can safely set genesisHash as the _genesis hash in this
    // object: it is either the one we put in the DB, or it is equal to the one
    // which we read from the DB.
    this._genesis = genesisHash

    // load verified iterator heads
    try {
      const heads = await this.dbManager.getHeads()
      this._heads = heads
    } catch (error) {
      if (error.type !== 'NotFoundError') {
        throw error
      }
      this._heads = {}
    }

    // load headerchain head
    try {
      const hash = await this.dbManager.getHeadHeader()
      this._headHeaderHash = hash
    } catch (error) {
      if (error.type !== 'NotFoundError') {
        throw error
      }
      this._headHeaderHash = genesisHash
    }

    // load blockchain head
    try {
      const hash = await this.dbManager.getHeadBlock()
      this._headBlockHash = hash
    } catch (error) {
      if (error.type !== 'NotFoundError') {
        throw error
      }
      this._headBlockHash = genesisHash
    }

    this._isInitialized = true
  }

  /**
   * Run a function after acquiring a lock. It is implied that we have already
   * initialized the module (or we are calling this from the init function, like
   * `_setCanonicalGenesisBlock`)
   * @param action - function to run after acquiring a lock
   * @hidden
   */
  private async runWithLock<T>(action: () => Promise<T>): Promise<T> {
    try {
      await this._lock.acquire()
      const value = await action()
      return value
    } finally {
      this._lock.release()
    }
  }

  private _requireClique() {
    if (this._common.consensusAlgorithm() !== 'clique') {
      throw new Error('Function call only supported for clique PoA networks')
    }
  }

  /**
   * Checks if signer was recently signed.
   * Returns true if signed too recently: more than once per `this.cliqueSignerLimit()` consecutive blocks.
   * @param header BlockHeader
   * @hidden
   */
  private cliqueCheckRecentlySigned(header: BlockHeader): boolean {
    if (header.isGenesis() || header.number.eqn(1)) {
      // skip genesis, first block
      return false
    }
    const limit = this.cliqueSignerLimit()
    // construct recent block signers list with this block
    let signers = this._cliqueLatestBlockSigners
    signers = signers.slice(signers.length < limit ? 0 : 1)
    signers.push([header.number, header.cliqueSigner()])
    const seen = signers.filter((s) => s[1].equals(header.cliqueSigner())).length
    return seen > 1
  }

  /**
   * Save genesis signers to db
   * @param genesisBlock genesis block
   * @hidden
   */
  private async cliqueSaveGenesisSigners(genesisBlock: Block) {
    const genesisSignerState: CliqueSignerState = [
      new BN(0),
      genesisBlock.header.cliqueEpochTransitionSigners(),
    ]
    await this.cliqueUpdateSignerStates(genesisSignerState)
    debug(`[Block 0] Genesis block -> update signer states`)
    await this.cliqueUpdateVotes()
  }

  /**
   * Save signer state to db
   * @param signerState
   * @hidden
   */
  private async cliqueUpdateSignerStates(signerState?: CliqueSignerState) {
    const dbOps: DBOp[] = []

    if (signerState) {
      this._cliqueLatestSignerStates.push(signerState)
    }

    // trim to CLIQUE_SIGNER_HISTORY_BLOCK_LIMIT
    const limit = this.CLIQUE_SIGNER_HISTORY_BLOCK_LIMIT
    const blockSigners = this._cliqueLatestBlockSigners
    const lastBlockNumber = blockSigners[blockSigners.length - 1]?.[0]
    if (lastBlockNumber) {
      const blockLimit = lastBlockNumber.subn(limit)
      const states = this._cliqueLatestSignerStates
      const lastItem = states[states.length - 1]
      this._cliqueLatestSignerStates = states.filter((state) => state[0].gte(blockLimit))
      if (this._cliqueLatestSignerStates.length === 0) {
        // always keep at least one item on the stack
        this._cliqueLatestSignerStates.push(lastItem)
      }
    }

    // save to db
    const formatted = this._cliqueLatestSignerStates.map((state) => [
      state[0].toBuffer(),
      state[1].map((a) => a.toBuffer()),
    ])
    dbOps.push(DBOp.set(DBTarget.CliqueSignerStates, rlp.encode(formatted)))

    await this.dbManager.batch(dbOps)
    // Output active signers for debugging purposes
    let i = 0
    for (const signer of this.cliqueActiveSigners()) {
      debug(`Clique signer [${i}]: ${signer}`)
      i++
    }
  }

  /**
   * Update clique votes and save to db
   * @param header BlockHeader
   * @hidden
   */
  private async cliqueUpdateVotes(header?: BlockHeader) {
    // Block contains a vote on a new signer
    if (header && !header.coinbase.isZero()) {
      const signer = header.cliqueSigner()
      const beneficiary = header.coinbase
      const nonce = header.nonce
      const latestVote: CliqueVote = [header.number, [signer, beneficiary, nonce]]

      // Do two rounds here, one to execute on a potential previously reached consensus
      // on the newly touched beneficiary, one with the added new vote
      for (let round = 1; round <= 2; round++) {
        // See if there is a new majority consensus to update the signer list
        const lastEpochBlockNumber = header.number.sub(
          header.number.mod(new BN(this._common.consensusConfig().epoch))
        )
        const limit = this.cliqueSignerLimit()
        let activeSigners = this.cliqueActiveSigners()
        let consensus = false

        // AUTH vote analysis
        let votes = this._cliqueLatestVotes.filter((vote) => {
          return (
            vote[0].gte(lastEpochBlockNumber) &&
            !vote[1][0].equals(signer) &&
            vote[1][1].equals(beneficiary) &&
            vote[1][2].equals(CLIQUE_NONCE_AUTH)
          )
        })
        const beneficiaryVotesAUTH: Address[] = []
        for (const vote of votes) {
          const num = beneficiaryVotesAUTH.filter((voteCMP) => {
            return voteCMP.equals(vote[1][0])
          }).length
          if (num === 0) {
            beneficiaryVotesAUTH.push(vote[1][0])
          }
        }
        let numBeneficiaryVotesAUTH = beneficiaryVotesAUTH.length
        if (round === 2 && nonce.equals(CLIQUE_NONCE_AUTH)) {
          numBeneficiaryVotesAUTH += 1
        }
        // Majority consensus
        if (numBeneficiaryVotesAUTH >= limit) {
          consensus = true
          // Authorize new signer
          activeSigners.push(beneficiary)
          activeSigners.sort((a, b) => {
            // Sort by buffer size
            return a.toBuffer().compare(b.toBuffer())
          })
          // Discard votes for added signer
          this._cliqueLatestVotes = this._cliqueLatestVotes.filter(
            (vote) => !vote[1][1].equals(beneficiary)
          )
          debug(
            `[Block ${header.number.toNumber()}] Clique majority consensus (AUTH ${beneficiary})`
          )
        }
        // DROP vote
        votes = this._cliqueLatestVotes.filter((vote) => {
          return (
            vote[0].gte(lastEpochBlockNumber) &&
            !vote[1][0].equals(signer) &&
            vote[1][1].equals(beneficiary) &&
            vote[1][2].equals(CLIQUE_NONCE_DROP)
          )
        })
        const beneficiaryVotesDROP: Address[] = []
        for (const vote of votes) {
          const num = beneficiaryVotesDROP.filter((voteCMP) => {
            return voteCMP.equals(vote[1][0])
          }).length
          if (num === 0) {
            beneficiaryVotesDROP.push(vote[1][0])
          }
        }
        let numBeneficiaryVotesDROP = beneficiaryVotesDROP.length

        if (round === 2 && nonce.equals(CLIQUE_NONCE_DROP)) {
          numBeneficiaryVotesDROP += 1
        }
        // Majority consensus
        if (numBeneficiaryVotesDROP >= limit) {
          consensus = true
          // Drop signer
          activeSigners = activeSigners.filter((signer) => !signer.equals(beneficiary))
          this._cliqueLatestVotes = this._cliqueLatestVotes.filter(
            // Discard votes from removed signer and for removed signer
            (vote) => !vote[1][0].equals(beneficiary) && !vote[1][1].equals(beneficiary)
          )
          debug(
            `[Block ${header.number.toNumber()}] Clique majority consensus (DROP ${beneficiary})`
          )
        }
        if (round === 1) {
          // Always add the latest vote to the history no matter if already voted
          // the same vote or not
          this._cliqueLatestVotes.push(latestVote)
          debug(
            `[Block ${header.number.toNumber()}] New clique vote: ${signer} -> ${beneficiary} ${
              nonce.equals(CLIQUE_NONCE_AUTH) ? 'AUTH' : 'DROP'
            }`
          )
        }
        if (consensus) {
          if (round === 1) {
            debug(
              `[Block ${header.number.toNumber()}] Clique majority consensus on existing votes -> update signer states`
            )
          } else {
            debug(
              `[Block ${header.number.toNumber()}] Clique majority consensus on new vote -> update signer states`
            )
          }
          const newSignerState: CliqueSignerState = [header.number, activeSigners]
          await this.cliqueUpdateSignerStates(newSignerState)
          return
        }
      }
    }

    // trim to lastEpochBlockNumber - CLIQUE_SIGNER_HISTORY_BLOCK_LIMIT
    const limit = this.CLIQUE_SIGNER_HISTORY_BLOCK_LIMIT
    const blockSigners = this._cliqueLatestBlockSigners
    const lastBlockNumber = blockSigners[blockSigners.length - 1]?.[0]
    if (lastBlockNumber) {
      const lastEpochBlockNumber = lastBlockNumber.sub(
        lastBlockNumber.mod(new BN(this._common.consensusConfig().epoch))
      )
      const blockLimit = lastEpochBlockNumber.subn(limit)
      this._cliqueLatestVotes = this._cliqueLatestVotes.filter((state) => state[0].gte(blockLimit))
    }

    // save votes to db
    const dbOps: DBOp[] = []
    const formatted = this._cliqueLatestVotes.map((v) => [
      v[0].toBuffer(),
      [v[1][0].toBuffer(), v[1][1].toBuffer(), v[1][2]],
    ])
    dbOps.push(DBOp.set(DBTarget.CliqueVotes, rlp.encode(formatted)))

    await this.dbManager.batch(dbOps)
  }

  /**
   * Update snapshot of latest clique block signers.
   * Used for checking for 'recently signed' error.
   * Length trimmed to `this.cliqueSignerLimit()`.
   * @param header BlockHeader
   * @hidden
   */
  private async cliqueUpdateLatestBlockSigners(header?: BlockHeader) {
    const dbOps: DBOp[] = []

    if (header) {
      if (header.isGenesis()) {
        return
      }

      // add this block's signer
      const signer: CliqueBlockSigner = [header.number, header.cliqueSigner()]
      this._cliqueLatestBlockSigners.push(signer)

      // trim length to `this.cliqueSignerLimit()`
      const length = this._cliqueLatestBlockSigners.length
      const limit = this.cliqueSignerLimit()
      if (length > limit) {
        this._cliqueLatestBlockSigners = this._cliqueLatestBlockSigners.slice(
          length - limit,
          length
        )
      }
    }

    // save to db
    const formatted = this._cliqueLatestBlockSigners.map((b) => [b[0].toBuffer(), b[1].toBuffer()])
    dbOps.push(DBOp.set(DBTarget.CliqueBlockSigners, rlp.encode(formatted)))

    await this.dbManager.batch(dbOps)
  }

  /**
   * Returns a list with the current block signers
   * (only clique PoA, throws otherwise)
   */
  public cliqueActiveSigners(): Address[] {
    this._requireClique()
    const signers = this._cliqueLatestSignerStates
    return [...signers[signers.length - 1][1]]
  }

  /**
   * Number of consecutive blocks out of which a signer may only sign one.
   * Defined as `Math.floor(SIGNER_COUNT / 2) + 1` to enforce majority consensus.
   * signer count -> signer limit:
   *   1 -> 1, 2 -> 2, 3 -> 2, 4 -> 2, 5 -> 3, ...
   * @hidden
   */
  private cliqueSignerLimit() {
    return Math.floor(this.cliqueActiveSigners().length / 2) + 1
  }

  /**
   * Returns the specified iterator head.
   *
   * This function replaces the old `getHead()` method. Note that
   * the function deviates from the old behavior and returns the
   * genesis hash instead of the current head block if an iterator
   * has not been run. This matches the behavior of the `iterator()`
   * method.
   *
   * @param name - Optional name of the iterator head (default: 'vm')
   */
  async getIteratorHead(name = 'vm'): Promise<Block> {
    return await this.runWithLock<Block>(async () => {
      // if the head is not found return the genesis hash
      const hash = this._heads[name] || this._genesis
      if (!hash) {
        throw new Error('No head found.')
      }

      const block = await this._getBlock(hash)
      return block
    })
  }

  /**
   * Returns the specified iterator head.
   *
   * @param name - Optional name of the iterator head (default: 'vm')
   *
   * @deprecated use `getIteratorHead()` instead. Note that `getIteratorHead()`
   * doesn't return the `headHeader` but the genesis hash as an initial
   * iterator head value (now matching the behavior of the `iterator()`
   * method on a first run)
   */
  async getHead(name = 'vm'): Promise<Block> {
    return await this.runWithLock<Block>(async () => {
      // if the head is not found return the headHeader
      const hash = this._heads[name] || this._headBlockHash
      if (!hash) {
        throw new Error('No head found.')
      }

      const block = await this._getBlock(hash)
      return block
    })
  }

  /**
   * Returns the latest header in the canonical chain.
   */
  async getLatestHeader(): Promise<BlockHeader> {
    return await this.runWithLock<BlockHeader>(async () => {
      if (!this._headHeaderHash) {
        throw new Error('No head header set')
      }

      const block = await this._getBlock(this._headHeaderHash)
      return block.header
    })
  }

  /**
   * Returns the latest full block in the canonical chain.
   */
  async getLatestBlock(): Promise<Block> {
    return this.runWithLock<Block>(async () => {
      if (!this._headBlockHash) {
        throw new Error('No head block set')
      }

      const block = this._getBlock(this._headBlockHash)
      return block
    })
  }

  /**
   * Adds blocks to the blockchain.
   *
   * If an invalid block is met the function will throw, blocks before will
   * nevertheless remain in the DB. If any of the saved blocks has a higher
   * total difficulty than the current max total difficulty the canonical
   * chain is rebuilt and any stale heads/hashes are overwritten.
   * @param blocks - The blocks to be added to the blockchain
   */
  async putBlocks(blocks: Block[]) {
    for (let i = 0; i < blocks.length; i++) {
      await this.putBlock(blocks[i])
    }
  }

  /**
   * Adds a block to the blockchain.
   *
   * If the block is valid and has a higher total difficulty than the current
   * max total difficulty, the canonical chain is rebuilt and any stale
   * heads/hashes are overwritten.
   * @param block - The block to be added to the blockchain
   */
  async putBlock(block: Block) {
    await this._putBlockOrHeader(block)
  }

  /**
   * Adds many headers to the blockchain.
   *
   * If an invalid header is met the function will throw, headers before will
   * nevertheless remain in the DB. If any of the saved headers has a higher
   * total difficulty than the current max total difficulty the canonical
   * chain is rebuilt and any stale heads/hashes are overwritten.
   * @param headers - The headers to be added to the blockchain
   */
  async putHeaders(headers: Array<any>) {
    for (let i = 0; i < headers.length; i++) {
      await this.putHeader(headers[i])
    }
  }

  /**
   * Adds a header to the blockchain.
   *
   * If this header is valid and it has a higher total difficulty than the current
   * max total difficulty, the canonical chain is rebuilt and any stale
   * heads/hashes are overwritten.
   * @param header - The header to be added to the blockchain
   */
  async putHeader(header: BlockHeader) {
    await this._putBlockOrHeader(header)
  }

  /**
   * Entrypoint for putting any block or block header. Verifies this block,
   * checks the total TD: if this TD is higher than the current highest TD, we
   * have thus found a new canonical block and have to rewrite the canonical
   * chain. This also updates the head block hashes. If any of the older known
   * canonical chains just became stale, then we also reset every _heads header
   * which points to a stale header to the last verified header which was in the
   * old canonical chain, but also in the new canonical chain. This thus rolls
   * back these headers so that these can be updated to the "new" canonical
   * header using the iterator method.
   * @hidden
   */
  private async _putBlockOrHeader(item: Block | BlockHeader) {
    await this.runWithLock<void>(async () => {
      const block =
        item instanceof BlockHeader
          ? new Block(item, undefined, undefined, {
              common: this._common,
              hardforkByBlockNumber: true,
            })
          : item
      const isGenesis = block.isGenesis()

      // we cannot overwrite the Genesis block after initializing the Blockchain

      if (isGenesis) {
        throw new Error('Cannot put a genesis block: create a new Blockchain')
      }

      const { header } = block
      const blockHash = header.hash()
      const blockNumber = header.number
      const td = header.difficulty.clone()
      const currentTd = { header: new BN(0), block: new BN(0) }
      let dbOps: DBOp[] = []

      if (!block._common.chainIdBN().eq(this._common.chainIdBN())) {
        throw new Error('Chain mismatch while trying to put block or header')
      }

      if (this._validateBlocks && !isGenesis) {
        // this calls into `getBlock`, which is why we cannot lock yet
        await block.validate(this)
      }

      if (this._validateConsensus) {
        if (this._common.consensusAlgorithm() === 'ethash') {
          const valid = await this._ethash!.verifyPOW(block)
          if (!valid) {
            throw new Error('invalid POW')
          }
        }

        if (this._common.consensusAlgorithm() === 'clique') {
          const valid = header.cliqueVerifySignature(this.cliqueActiveSigners())
          if (!valid) {
            throw new Error('invalid PoA block signature (clique)')
          }

          if (this.cliqueCheckRecentlySigned(header)) {
            throw new Error('recently signed')
          }
        }
      }

      if (this._common.consensusAlgorithm() === 'clique') {
        // validate checkpoint signers towards active signers on epoch transition blocks
        if (header.cliqueIsEpochTransition()) {
          // note: keep votes on epoch transition blocks in case of reorgs.
          // only active (non-stale) votes will counted (if vote.blockNumber >= lastEpochBlockNumber)

          const checkpointSigners = header.cliqueEpochTransitionSigners()
          const activeSigners = this.cliqueActiveSigners()
          for (const [i, cSigner] of checkpointSigners.entries()) {
            if (!activeSigners[i] || !activeSigners[i].equals(cSigner)) {
              throw new Error(
                `checkpoint signer not found in active signers list at index ${i}: ${cSigner.toString()}`
              )
            }
          }
        }
      }

      // set total difficulty in the current context scope
      if (this._headHeaderHash) {
        currentTd.header = await this.getTotalDifficulty(this._headHeaderHash)
      }
      if (this._headBlockHash) {
        currentTd.block = await this.getTotalDifficulty(this._headBlockHash)
      }

      // calculate the total difficulty of the new block
      let parentTd = new BN(0)
      if (!block.isGenesis()) {
        parentTd = await this.getTotalDifficulty(header.parentHash, blockNumber.subn(1))
      }
      td.iadd(parentTd)

      // save total difficulty to the database
      dbOps = dbOps.concat(DBSetTD(td, blockNumber, blockHash))

      // save header/block to the database
      dbOps = dbOps.concat(DBSetBlockOrHeader(block))

      // if total difficulty is higher than current, add it to canonical chain
      if (
        block.isGenesis() ||
        (this._common.consensusType() === 'pow' && td.gt(currentTd.header)) ||
        this._common.consensusType() === 'poa'
      ) {
        this._headHeaderHash = blockHash
        if (item instanceof Block) {
          this._headBlockHash = blockHash
        }

        // TODO SET THIS IN CONSTRUCTOR
        if (block.isGenesis()) {
          this._genesis = blockHash
        }

        // Clique: update signer votes and state
        if (this._common.consensusAlgorithm() === 'clique') {
          if (!header.cliqueIsEpochTransition()) {
            await this.cliqueUpdateVotes(header)
          }
          await this.cliqueUpdateLatestBlockSigners(header)
        }

        // delete higher number assignments and overwrite stale canonical chain
        await this._deleteCanonicalChainReferences(blockNumber.addn(1), blockHash, dbOps)
        // from the current header block, check the blockchain in reverse (i.e.
        // traverse `parentHash`) until `numberToHash` matches the current
        // number/hash in the canonical chain also: overwrite any heads if these
        // heads are stale in `_heads` and `_headBlockHash`
        await this._rebuildCanonical(header, dbOps)
      } else {
        // the TD is lower than the current highest TD so we will add the block
        // to the DB, but will not mark it as the canonical chain.
        if (td.gt(currentTd.block) && item instanceof Block) {
          this._headBlockHash = blockHash
        }
        // save hash to number lookup info even if rebuild not needed
        dbOps.push(DBSetHashToNumber(blockHash, blockNumber))
      }

      const ops = dbOps.concat(this._saveHeadOps())
      await this.dbManager.batch(ops)
    })
  }

  /**
   * Gets a block by its hash.
   *
   * @param blockId - The block's hash or number. If a hash is provided, then
   * this will be immediately looked up, otherwise it will wait until we have
   * unlocked the DB
   */
  async getBlock(blockId: Buffer | number | BN): Promise<Block> {
    // cannot wait for a lock here: it is used both in `validate` of `Block`
    // (calls `getBlock` to get `parentHash`) it is also called from `runBlock`
    // in the `VM` if we encounter a `BLOCKHASH` opcode: then a BN is used we
    // need to then read the block from the canonical chain Q: is this safe? We
    // know it is OK if we call it from the iterator... (runBlock)
    return await this._getBlock(blockId)
  }

  /**
   * @hidden
   */
  private async _getBlock(blockId: Buffer | number | BN) {
    return this.dbManager.getBlock(blockId)
  }

  /**
   * Gets total difficulty for a block specified by hash and number
   */
  public async getTotalDifficulty(hash: Buffer, number?: BN): Promise<BN> {
    if (!number) {
      number = await this.dbManager.hashToNumber(hash)
    }
    return this.dbManager.getTotalDifficulty(hash, number)
  }

  /**
   * Looks up many blocks relative to blockId Note: due to `GetBlockHeaders
   * (0x03)` (ETH wire protocol) we have to support skip/reverse as well.
   * @param blockId - The block's hash or number
   * @param maxBlocks - Max number of blocks to return
   * @param skip - Number of blocks to skip apart
   * @param reverse - Fetch blocks in reverse
   */
  async getBlocks(
    blockId: Buffer | BN | number,
    maxBlocks: number,
    skip: number,
    reverse: boolean
  ): Promise<Block[]> {
    return await this.runWithLock<Block[]>(async () => {
      const blocks: Block[] = []
      let i = -1

      const nextBlock = async (blockId: Buffer | BN | number): Promise<any> => {
        let block
        try {
          block = await this._getBlock(blockId)
        } catch (error) {
          if (error.type !== 'NotFoundError') {
            throw error
          }
          return
        }
        i++
        const nextBlockNumber = block.header.number.addn(reverse ? -1 : 1)
        if (i !== 0 && skip && i % (skip + 1) !== 0) {
          return await nextBlock(nextBlockNumber)
        }
        blocks.push(block)
        if (blocks.length < maxBlocks) {
          await nextBlock(nextBlockNumber)
        }
      }

      await nextBlock(blockId)
      return blocks
    })
  }

  /**
   * Given an ordered array, returns an array of hashes that are not in the
   * blockchain yet. Uses binary search to find out what hashes are missing.
   * Therefore, the array needs to be ordered upon number.
   * @param hashes - Ordered array of hashes (ordered on `number`).
   */
  async selectNeededHashes(hashes: Array<Buffer>): Promise<Buffer[]> {
    return await this.runWithLock<Buffer[]>(async () => {
      let max: number
      let mid: number
      let min: number

      max = hashes.length - 1
      mid = min = 0

      while (max >= min) {
        let number
        try {
          number = await this.dbManager.hashToNumber(hashes[mid])
        } catch (error) {
          if (error.type !== 'NotFoundError') {
            throw error
          }
        }
        if (number) {
          min = mid + 1
        } else {
          max = mid - 1
        }
        mid = Math.floor((min + max) / 2)
      }
      return hashes.slice(min)
    })
  }

  /**
   * Completely deletes a block from the blockchain including any references to
   * this block. If this block was in the canonical chain, then also each child
   * block of this block is deleted Also, if this was a canonical block, each
   * head header which is part of this now stale chain will be set to the
   * parentHeader of this block An example reason to execute is when running the
   * block in the VM invalidates this block: this will then reset the canonical
   * head to the past block (which has been validated in the past by the VM, so
   * we can be sure it is correct).
   * @param blockHash - The hash of the block to be deleted
   */
  async delBlock(blockHash: Buffer) {
    // Q: is it safe to make this not wait for a lock? this is called from
    // `runBlockchain` in case `runBlock` throws (i.e. the block is invalid).
    // But is this the way to go? If we know this is called from the
    // iterator/runBlockchain we are safe, but if this is called from anywhere
    // else then this might lead to a concurrency problem?
    await this._delBlock(blockHash)
  }

  /**
   * @hidden
   */
  private async _delBlock(blockHash: Buffer) {
    const dbOps: DBOp[] = []

    // get header
    const header = await this._getHeader(blockHash)
    const blockHeader = header
    const blockNumber = blockHeader.number
    const parentHash = blockHeader.parentHash

    // check if block is in the canonical chain
    const canonicalHash = await this.safeNumberToHash(blockNumber)

    const inCanonical = !!canonicalHash && canonicalHash.equals(blockHash)

    // delete the block, and if block is in the canonical chain, delete all
    // children as well
    await this._delChild(blockHash, blockNumber, inCanonical ? parentHash : null, dbOps)

    // delete all number to hash mappings for deleted block number and above
    if (inCanonical) {
      await this._deleteCanonicalChainReferences(blockNumber, parentHash, dbOps)
    }

    await this.dbManager.batch(dbOps)
  }

  /**
   * Updates the `DatabaseOperation` list to delete a block from the DB,
   * identified by `blockHash` and `blockNumber`. Deletes fields from `Header`,
   * `Body`, `HashToNumber` and `TotalDifficulty` tables. If child blocks of
   * this current block are in the canonical chain, delete these as well. Does
   * not actually commit these changes to the DB. Sets `_headHeaderHash` and
   * `_headBlockHash` to `headHash` if any of these matches the current child to
   * be deleted.
   * @param blockHash - the block hash to delete
   * @param blockNumber - the number corresponding to the block hash
   * @param headHash - the current head of the chain (if null, do not update
   * `_headHeaderHash` and `_headBlockHash`)
   * @param ops - the `DatabaseOperation` list to add the delete operations to
   * @hidden
   */
  private async _delChild(
    blockHash: Buffer,
    blockNumber: BN,
    headHash: Buffer | null,
    ops: DBOp[]
  ) {
    // delete header, body, hash to number mapping and td
    ops.push(DBOp.del(DBTarget.Header, { blockHash, blockNumber }))
    ops.push(DBOp.del(DBTarget.Body, { blockHash, blockNumber }))
    ops.push(DBOp.del(DBTarget.HashToNumber, { blockHash }))
    ops.push(DBOp.del(DBTarget.TotalDifficulty, { blockHash, blockNumber }))

    if (!headHash) {
      return
    }

    if (this._headHeaderHash?.equals(blockHash)) {
      this._headHeaderHash = headHash
    }

    if (this._headBlockHash?.equals(blockHash)) {
      this._headBlockHash = headHash
    }

    try {
      const childHeader = await this._getCanonicalHeader(blockNumber.addn(1))
      await this._delChild(childHeader.hash(), childHeader.number, headHash, ops)
    } catch (error) {
      if (error.type !== 'NotFoundError') {
        throw error
      }
    }
  }

  /**
   * Iterates through blocks starting at the specified iterator head and calls
   * the onBlock function on each block. The current location of an iterator
   * head can be retrieved using the `getHead()` method.
   *
   * @param name - Name of the state root head
   * @param onBlock - Function called on each block with params (block, reorg)
   * @param maxBlocks - How many blocks to run. By default, run all unprocessed blocks in the canonical chain.
   * @returns number of blocks actually iterated
   */
  async iterator(name: string, onBlock: OnBlock, maxBlocks?: number): Promise<number> {
    return this._iterator(name, onBlock, maxBlocks)
  }

  /**
   * @hidden
   */
  private async _iterator(name: string, onBlock: OnBlock, maxBlocks?: number): Promise<number> {
    return await this.runWithLock<number>(
      async (): Promise<number> => {
        const headHash = this._heads[name] || this._genesis
        let lastBlock: Block | undefined

        if (!headHash) {
          return 0
        }

        if (maxBlocks && maxBlocks < 0) {
          throw 'If maxBlocks is provided, it has to be a non-negative number'
        }

        const headBlockNumber = await this.dbManager.hashToNumber(headHash)
        const nextBlockNumber = headBlockNumber.addn(1)
        let blocksRanCounter = 0

        while (maxBlocks !== blocksRanCounter) {
          try {
            const nextBlock = await this._getBlock(nextBlockNumber)
            this._heads[name] = nextBlock.hash()
            const reorg = lastBlock ? lastBlock.hash().equals(nextBlock.header.parentHash) : false
            lastBlock = nextBlock
            await onBlock(nextBlock, reorg)
            nextBlockNumber.iaddn(1)
            blocksRanCounter++
          } catch (error) {
            if (error.type === 'NotFoundError') {
              break
            } else {
              throw error
            }
          }
        }

        await this._saveHeads()
        return blocksRanCounter
      }
    )
  }

  /**
   * Set header hash of a certain `tag`.
   * When calling the iterator, the iterator will start running the first child block after the header hash currenntly stored.
   * @param tag - The tag to save the headHash to
   * @param headHash - The head hash to save
   */
  async setIteratorHead(tag: string, headHash: Buffer) {
    return await this.setHead(tag, headHash)
  }

  /**
   * Set header hash of a certain `tag`.
   * When calling the iterator, the iterator will start running the first child block after the header hash currenntly stored.
   * @param tag - The tag to save the headHash to
   * @param headHash - The head hash to save
   *
   * @deprecated use `setIteratorHead()` instead
   */
  async setHead(tag: string, headHash: Buffer) {
    await this.runWithLock<void>(async () => {
      this._heads[tag] = headHash
      await this._saveHeads()
    })
  }

  /* Methods regarding re-org operations */

  /**
   * Pushes DB operations to delete canonical number assignments for specified
   * block number and above This only deletes `NumberToHash` references, and not
   * the blocks themselves. Note: this does not write to the DB but only pushes
   * to a DB operations list.
   * @param blockNumber - the block number from which we start deleting
   * canonical chain assignments (including this block)
   * @param headHash - the hash of the current canonical chain head. The _heads
   * reference matching any hash of any of the deleted blocks will be set to
   * this
   * @param ops - the DatabaseOperation list to write DatabaseOperations to
   * @hidden
   */
  private async _deleteCanonicalChainReferences(blockNumber: BN, headHash: Buffer, ops: DBOp[]) {
    blockNumber = blockNumber.clone()
    let hash: Buffer | false

    hash = await this.safeNumberToHash(blockNumber)
    while (hash) {
      ops.push(DBOp.del(DBTarget.NumberToHash, { blockNumber }))

      // reset stale iterator heads to current canonical head this can, for
      // instance, make the VM run "older" (i.e. lower number blocks than last
      // executed block) blocks to verify the chain up to the current, actual,
      // head.
      Object.keys(this._heads).forEach((name) => {
        if (this._heads[name].equals(<Buffer>hash)) {
          // explicitly cast as Buffer: it is not possible that `hash` is false
          // here, but TypeScript does not understand this.
          this._heads[name] = headHash
        }
      })

      // reset stale headBlock to current canonical
      if (this._headBlockHash?.equals(hash)) {
        this._headBlockHash = headHash
      }

      if (this._common.consensusAlgorithm() === 'clique') {
        // remove blockNumber from clique snapshots
        // (latest signer states, latest votes, latest block signers)
        this._cliqueLatestSignerStates = this._cliqueLatestSignerStates.filter(
          (s) => !s[0].eq(blockNumber)
        )
        await this.cliqueUpdateSignerStates()

        this._cliqueLatestVotes = this._cliqueLatestVotes.filter((v) => !v[0].eq(blockNumber))
        await this.cliqueUpdateVotes()

        this._cliqueLatestBlockSigners = this._cliqueLatestBlockSigners.filter(
          (s) => !s[0].eq(blockNumber)
        )
        await this.cliqueUpdateLatestBlockSigners()
      }

      blockNumber.iaddn(1)

      hash = await this.safeNumberToHash(blockNumber)
    }
  }

  /**
   * Given a `header`, put all operations to change the canonical chain directly
   * into `ops`. This walks the supplied `header` backwards. It is thus assumed
   * that this header should be canonical header. For each header the
   * corresponding hash corresponding to the current canonical chain in the DB
   * is checked If the number => hash reference does not correspond to the
   * reference in the DB, we overwrite this reference with the implied number =>
   * hash reference Also, each `_heads` member is checked; if these point to a
   * stale hash, then the hash which we terminate the loop (i.e. the first hash
   * which matches the number => hash of the implied chain) is put as this stale
   * head hash The same happens to _headBlockHash
   * @param header - The canonical header.
   * @param ops - The database operations list.
   * @hidden
   */
  private async _rebuildCanonical(header: BlockHeader, ops: DBOp[]) {
    const currentNumber = header.number.clone() // we change this during this method with `isubn`
    let currentCanonicalHash: Buffer = header.hash()

    // track the staleHash: this is the hash currently in the DB which matches
    // the block number of the provided header.
    let staleHash: Buffer | false = false
    let staleHeads: string[] = []
    let staleHeadBlock = false

    const loopCondition = async () => {
      staleHash = await this.safeNumberToHash(currentNumber)
      currentCanonicalHash = header.hash()
      return !staleHash || !currentCanonicalHash.equals(staleHash)
    }

    while (await loopCondition()) {
      // handle genesis block
      const blockHash = header.hash()
      const blockNumber = header.number

      DBSaveLookups(blockHash, blockNumber).map((op) => {
        ops.push(op)
      })

      if (blockNumber.isZero()) {
        break
      }

      // mark each key `_heads` which is currently set to the hash in the DB as
      // stale to overwrite this later.
      Object.keys(this._heads).forEach((name) => {
        if (staleHash && this._heads[name].equals(staleHash)) {
          staleHeads.push(name)
        }
      })
      // flag stale headBlock for reset
      if (staleHash && this._headBlockHash?.equals(staleHash)) {
        staleHeadBlock = true
      }

      currentNumber.isubn(1)
      try {
        header = await this._getHeader(header.parentHash, currentNumber)
      } catch (error) {
        staleHeads = []
        if (error.type !== 'NotFoundError') {
          throw error
        }
        break
      }
    }
    // the stale hash is equal to the blockHash set stale heads to last
    // previously valid canonical block
    staleHeads.forEach((name: string) => {
      this._heads[name] = currentCanonicalHash
    })
    // set stale headBlock to last previously valid canonical block
    if (staleHeadBlock) {
      this._headBlockHash = currentCanonicalHash
    }
  }

  /* Helper functions */

  /**
   * Builds the `DatabaseOperation[]` list which describes the DB operations to
   * write the heads, head header hash and the head header block to the DB
   * @hidden
   */
  private _saveHeadOps(): DBOp[] {
    return [
      DBOp.set(DBTarget.Heads, this._heads),
      DBOp.set(DBTarget.HeadHeader, this._headHeaderHash!),
      DBOp.set(DBTarget.HeadBlock, this._headBlockHash!),
    ]
  }

  /**
   * Gets the `DatabaseOperation[]` list to save `_heads`, `_headHeaderHash` and
   * `_headBlockHash` and writes these to the DB
   * @hidden
   */
  private async _saveHeads() {
    return this.dbManager.batch(this._saveHeadOps())
  }

  /**
   * Gets a header by hash and number. Header can exist outside the canonical
   * chain
   *
   * @hidden
   */
  private async _getHeader(hash: Buffer, number?: BN) {
    if (!number) {
      number = await this.dbManager.hashToNumber(hash)
    }
    return this.dbManager.getHeader(hash, number)
  }

  /**
   * Gets a header by number. Header must be in the canonical chain
   *
   * @hidden
   */
  private async _getCanonicalHeader(number: BN) {
    const hash = await this.dbManager.numberToHash(number)
    return this._getHeader(hash, number)
  }

  /**
   * This method either returns a Buffer if there exists one in the DB or if it
   * does not exist (DB throws a `NotFoundError`) then return false If DB throws
   * any other error, this function throws.
   * @param number
   */
  async safeNumberToHash(number: BN): Promise<Buffer | false> {
    try {
      const hash = await this.dbManager.numberToHash(number)
      return hash
    } catch (error) {
      if (error.type !== 'NotFoundError') {
        throw error
      }
      return false
    }
  }
}
