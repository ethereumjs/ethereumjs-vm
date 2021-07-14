/* eslint-disable no-dupe-class-members */

import { BaseTrie as Trie } from 'merkle-patricia-tree'
import { BN, rlp, keccak256, KECCAK256_RLP } from 'ethereumjs-util'
import Common from '@ethereumjs/common'
import {
  TransactionFactory,
  TypedTransaction,
  TxOptions,
  FeeMarketEIP1559Transaction,
  Transaction,
  Capability,
} from '@ethereumjs/tx'
import { BlockHeader } from './header'
import { BlockData, BlockOptions, JsonBlock, BlockBuffer, Blockchain } from './types'

/**
 * An object that represents the block.
 */
export class Block {
  public readonly header: BlockHeader
  public readonly transactions: TypedTransaction[] = []
  public readonly uncleHeaders: BlockHeader[] = []
  public readonly txTrie = new Trie()
  public readonly _common: Common

  /**
   * Static constructor to create a block from a block data dictionary
   *
   * @param blockData
   * @param opts
   */
  public static fromBlockData(blockData: BlockData = {}, opts?: BlockOptions) {
    const { header: headerData, transactions: txsData, uncleHeaders: uhsData } = blockData

    const header = BlockHeader.fromHeaderData(headerData, opts)

    // parse transactions
    const transactions = []
    for (const txData of txsData ?? []) {
      const tx = TransactionFactory.fromTxData(txData, {
        ...opts,
        // Use header common in case of hardforkByBlockNumber being activated
        common: header._common,
      } as TxOptions)
      transactions.push(tx)
    }

    // parse uncle headers
    const uncleHeaders = []
    for (const uhData of uhsData ?? []) {
      const cachedFork = header._common.hardfork()
      const uh = BlockHeader.fromHeaderData(uhData, {
        hardforkByBlockNumber: true,
        ...opts, // This potentially overwrites hardforkByBlocknumber
        // Use header common in case of hardforkByBlockNumber being activated
        common: header._common,
        // Disable this option here (all other options carried over), since this overwrites
        // the provided Difficulty to an incorrect value
        calcDifficultyFromHeader: undefined,
      })
      uncleHeaders.push(uh)
      header._common.setHardfork(cachedFork)
    }

    return new Block(header, transactions, uncleHeaders, opts)
  }

  /**
   * Static constructor to create a block from a RLP-serialized block
   *
   * @param serialized
   * @param opts
   */
  public static fromRLPSerializedBlock(serialized: Buffer, opts?: BlockOptions) {
    const values = rlp.decode(serialized) as any as BlockBuffer

    if (!Array.isArray(values)) {
      throw new Error('Invalid serialized block input. Must be array')
    }

    return Block.fromValuesArray(values, opts)
  }

  /**
   * Static constructor to create a block from an array of Buffer values
   *
   * @param values
   * @param opts
   */
  public static fromValuesArray(values: BlockBuffer, opts?: BlockOptions) {
    if (values.length > 3) {
      throw new Error('invalid block. More values than expected were received')
    }

    const [headerData, txsData, uhsData] = values

    const header = BlockHeader.fromValuesArray(headerData, opts)

    // parse transactions
    const transactions = []
    for (const txData of txsData || []) {
      transactions.push(
        TransactionFactory.fromBlockBodyData(txData, {
          ...opts,
          // Use header common in case of hardforkByBlockNumber being activated
          common: header._common,
        })
      )
    }

    // parse uncle headers
    const uncleHeaders = []
    for (const uncleHeaderData of uhsData || []) {
      const cachedFork = header._common.hardfork()
      uncleHeaders.push(
        BlockHeader.fromValuesArray(uncleHeaderData, {
          hardforkByBlockNumber: true,
          ...opts, // This potentially overwrites hardforkByBlocknumber
          // Use header common in case of hardforkByBlockNumber being activated
          common: header._common,
          // Disable this option here (all other options carried over), since this overwrites the provided Difficulty to an incorrect value
          calcDifficultyFromHeader: undefined,
        })
      )
      header._common.setHardfork(cachedFork)
    }

    return new Block(header, transactions, uncleHeaders, opts)
  }

  /**
   * Alias for {@link Block.fromBlockData} with {@link BlockOptions.initWithGenesisHeader} set to true.
   */
  public static genesis(blockData: BlockData = {}, opts?: BlockOptions) {
    opts = { ...opts, initWithGenesisHeader: true }
    return Block.fromBlockData(blockData, opts)
  }

  /**
   * This constructor takes the values, validates them, assigns them and freezes the object.
   * Use the static factory methods to assist in creating a Block object from varying data types and options.
   */
  constructor(
    header?: BlockHeader,
    transactions: TypedTransaction[] = [],
    uncleHeaders: BlockHeader[] = [],
    opts: BlockOptions = {}
  ) {
    this.header = header ?? BlockHeader.fromHeaderData({}, opts)
    this.transactions = transactions
    this.uncleHeaders = uncleHeaders
    this._common = this.header._common
    if (this._common.consensusType() === 'poa' && uncleHeaders.length > 0) {
      throw new Error('Block initialization with uncleHeaders on a PoA network is not allowed')
    }

    const freeze = opts?.freeze ?? true
    if (freeze) {
      Object.freeze(this)
    }
  }

  /**
   * Returns a Buffer Array of the raw Buffers of this block, in order.
   */
  raw(): BlockBuffer {
    return [
      this.header.raw(),
      this.transactions.map((tx) =>
        tx.supports(Capability.EIP2718TypedTransaction) ? tx.serialize() : tx.raw()
      ) as Buffer[],
      this.uncleHeaders.map((uh) => uh.raw()),
    ]
  }

  /**
   * Produces a hash the RLP of the block.
   */
  hash(): Buffer {
    return this.header.hash()
  }

  /**
   * Determines if this block is the genesis block.
   */
  isGenesis(): boolean {
    return this.header.isGenesis()
  }

  /**
   * Returns the rlp encoding of the block.
   */
  serialize(): Buffer {
    return rlp.encode(this.raw())
  }

  /**
   * Generates transaction trie for validation.
   */
  async genTxTrie(): Promise<void> {
    const { transactions, txTrie } = this
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i]
      const key = rlp.encode(i)
      const value = tx.serialize()
      await txTrie.put(key, value)
    }
  }

  /**
   * Validates the transaction trie by generating a trie
   * and do a check on the root hash.
   */
  async validateTransactionsTrie(): Promise<boolean> {
    let result
    if (this.transactions.length === 0) {
      result = this.header.transactionsTrie.equals(KECCAK256_RLP)
      return result
    }

    if (this.txTrie.root.equals(KECCAK256_RLP)) {
      await this.genTxTrie()
    }
    result = this.txTrie.root.equals(this.header.transactionsTrie)
    return result
  }

  /**
   * Validates transaction signatures and minimum gas requirements.
   *
   * @param stringError - If `true`, a string with the indices of the invalid txs is returned.
   */
  validateTransactions(): boolean
  validateTransactions(stringError: false): boolean
  validateTransactions(stringError: true): string[]
  validateTransactions(stringError = false) {
    const errors: string[] = []
    this.transactions.forEach((tx, i) => {
      const errs = <string[]>tx.validate(true)
      if (this._common.isActivatedEIP(1559)) {
        if (tx.supports(Capability.EIP1559FeeMarket)) {
          tx = tx as FeeMarketEIP1559Transaction
          if (tx.maxFeePerGas.lt(this.header.baseFeePerGas!)) {
            errs.push('tx unable to pay base fee (EIP-1559 tx)')
          }
        } else {
          tx = tx as Transaction
          if (tx.gasPrice.lt(this.header.baseFeePerGas!)) {
            errs.push('tx unable to pay base fee (non EIP-1559 tx)')
          }
        }
      }
      if (errs.length > 0) {
        errors.push(`errors at tx ${i}: ${errs.join(', ')}`)
      }
    })

    return stringError ? errors : errors.length === 0
  }

  /**
   * Performs the following consistency checks on the block:
   *
   * - Value checks on the header fields
   * - Signature and gasLimit validation for included txs
   * - Validation of the tx trie
   * - Consistency checks and header validation of included uncles
   *
   * Throws if invalid.
   *
   * @param blockchain - validate against an @ethereumjs/blockchain
   * @param onlyHeader - if should only validate the header (skips validating txTrie and unclesHash) (default: false)
   */
  async validate(blockchain: Blockchain, onlyHeader: boolean = false): Promise<void> {
    await this.header.validate(blockchain)
    await this.validateUncles(blockchain)
    await this.validateData(onlyHeader)
  }
  /**
   * Validates the block data, throwing if invalid.
   * This can be checked on the Block itself without needing access to any parent block
   * It checks:
   * - All transactions are valid
   * - The transactions trie is valid
   * - The uncle hash is valid
   * @param onlyHeader if only passed the header, skip validating txTrie and unclesHash (default: false)
   */
  async validateData(onlyHeader: boolean = false): Promise<void> {
    const txErrors = this.validateTransactions(true)
    if (txErrors.length > 0) {
      const msg = `invalid transactions: ${txErrors.join(' ')}`
      throw this.header._error(msg)
    }

    if (!onlyHeader) {
      const validateTxTrie = await this.validateTransactionsTrie()
      if (!validateTxTrie) {
        throw new Error('invalid transaction trie')
      }

      if (!this.validateUnclesHash()) {
        throw new Error('invalid uncle hash')
      }
    }
  }

  /**
   * Validates the uncle's hash.
   */
  validateUnclesHash(): boolean {
    const raw = rlp.encode(this.uncleHeaders.map((uh) => uh.raw()))
    return keccak256(raw).equals(this.header.uncleHash)
  }

  /**
   * Consistency checks and header validation for uncles included,
   * in the block, if any.
   *
   * Throws if invalid.
   *
   * The rules of uncles are the following:
   * Uncle Header is a valid header.
   * Uncle Header is an orphan, i.e. it is not one of the headers of the canonical chain.
   * Uncle Header has a parentHash which points to the canonical chain. This parentHash is within the last 7 blocks.
   * Uncle Header is not already included as uncle in another block.
   * Header has at most 2 uncles.
   * Header does not count an uncle twice.
   *
   * @param blockchain - additionally validate against an @ethereumjs/blockchain instance
   */
  async validateUncles(blockchain: Blockchain): Promise<void> {
    if (this.isGenesis()) {
      return
    }

    // Header has at most 2 uncles
    if (this.uncleHeaders.length > 2) {
      throw new Error('too many uncle headers')
    }

    // Header does not count an uncle twice.
    const uncleHashes = this.uncleHeaders.map((header) => header.hash().toString('hex'))
    if (!(new Set(uncleHashes).size === uncleHashes.length)) {
      throw new Error('duplicate uncles')
    }

    await this._validateUncleHeaders(this.uncleHeaders, blockchain)
  }

  /**
   * Returns the canonical difficulty for this block.
   *
   * @param parentBlock - the parent of this `Block`
   */
  canonicalDifficulty(parentBlock: Block): BN {
    return this.header.canonicalDifficulty(parentBlock.header)
  }

  /**
   * Checks that the block's `difficulty` matches the canonical difficulty.
   *
   * @param parentBlock - the parent of this `Block`
   */
  validateDifficulty(parentBlock: Block): boolean {
    return this.header.validateDifficulty(parentBlock.header)
  }

  /**
   * Validates if the block gasLimit remains in the
   * boundaries set by the protocol.
   *
   * @param parentBlock - the parent of this `Block`
   */
  validateGasLimit(parentBlock: Block): boolean {
    return this.header.validateGasLimit(parentBlock.header)
  }

  /**
   * Returns the block in JSON format.
   */
  toJSON(): JsonBlock {
    return {
      header: this.header.toJSON(),
      transactions: this.transactions.map((tx) => tx.toJSON()),
      uncleHeaders: this.uncleHeaders.map((uh) => uh.toJSON()),
    }
  }

  /**
   * Internal helper function to create an annotated error message
   *
   * @param msg Base error message
   * @hidden
   */
  _error(msg: string) {
    return this.header._error(msg)
  }

  /**
   * The following rules are checked in this method:
   * Uncle Header is a valid header.
   * Uncle Header is an orphan, i.e. it is not one of the headers of the canonical chain.
   * Uncle Header has a parentHash which points to the canonical chain. This parentHash is within the last 7 blocks.
   * Uncle Header is not already included as uncle in another block.
   * @param uncleHeaders - list of uncleHeaders
   * @param blockchain - pointer to the blockchain
   */
  private async _validateUncleHeaders(uncleHeaders: BlockHeader[], blockchain: Blockchain) {
    if (uncleHeaders.length == 0) {
      return
    }

    // Each Uncle Header is a valid header
    await Promise.all(uncleHeaders.map((uh) => uh.validate(blockchain, this.header.number)))

    // Check how many blocks we should get in order to validate the uncle.
    // In the worst case, we get 8 blocks, in the best case, we only get 1 block.
    const canonicalBlockMap: Block[] = []
    let lowestUncleNumber = this.header.number.clone()

    uncleHeaders.map((header) => {
      if (header.number.lt(lowestUncleNumber)) {
        lowestUncleNumber = header.number.clone()
      }
    })

    // Helper variable: set hash to `true` if hash is part of the canonical chain
    const canonicalChainHashes: { [key: string]: boolean } = {}

    // Helper variable: set hash to `true` if uncle hash is included in any canonical block
    const includedUncles: { [key: string]: boolean } = {}

    // Due to the header validation check above, we know that `getBlocks` is between 1 and 8 inclusive.
    const getBlocks = this.header.number.clone().sub(lowestUncleNumber).addn(1).toNumber()

    // See Geth: https://github.com/ethereum/go-ethereum/blob/b63bffe8202d46ea10ac8c4f441c582642193ac8/consensus/ethash/consensus.go#L207
    // Here we get the necessary blocks from the chain.
    let parentHash = this.header.parentHash
    for (let i = 0; i < getBlocks; i++) {
      const parentBlock = await this._getBlockByHash(blockchain, parentHash)
      if (!parentBlock) {
        throw new Error('could not find parent block')
      }
      canonicalBlockMap.push(parentBlock)

      // mark block hash as part of the canonical chain
      canonicalChainHashes[parentBlock.hash().toString('hex')] = true

      // for each of the uncles, mark the uncle as included
      parentBlock.uncleHeaders.map((uh) => {
        includedUncles[uh.hash().toString('hex')] = true
      })

      parentHash = parentBlock.header.parentHash
    }

    // Here we check:
    // Uncle Header is an orphan, i.e. it is not one of the headers of the canonical chain.
    // Uncle Header is not already included as uncle in another block.
    // Uncle Header has a parentHash which points to the canonical chain.

    uncleHeaders.map((uh) => {
      const uncleHash = uh.hash().toString('hex')
      const parentHash = uh.parentHash.toString('hex')

      if (!canonicalChainHashes[parentHash]) {
        throw new Error('The parent hash of the uncle header is not part of the canonical chain')
      }

      if (includedUncles[uncleHash]) {
        throw new Error('The uncle is already included in the canonical chain')
      }

      if (canonicalChainHashes[uncleHash]) {
        throw new Error('The uncle is a canonical block')
      }
    })
  }

  private async _getBlockByHash(blockchain: Blockchain, hash: Buffer): Promise<Block | undefined> {
    try {
      const block = await blockchain.getBlock(hash)
      return block
    } catch (error) {
      if (error.type === 'NotFoundError') {
        return undefined
      } else {
        throw error
      }
    }
  }
}
