import { EventEmitter } from 'events'
import { Block, BlockHeader } from '@ethereumjs/block'
import Blockchain from '@ethereumjs/blockchain'
import { BN, toBuffer } from 'ethereumjs-util'
import type { LevelUp } from 'levelup'
import { Config } from '../config'

/**
 * The options that the Blockchain constructor can receive.
 */
export interface ChainOptions {
  /**
   * Client configuration instance
   */
  config: Config

  /**
   * Database to store blocks and metadata. Should be an abstract-leveldown compliant store.
   */
  chainDB?: LevelUp

  /**
   * Specify a blockchain which implements the Chain interface
   */
  blockchain?: Blockchain
}

/**
 * Returns properties of the canonical blockchain.
 */
export interface ChainBlocks {
  /**
   * The latest block in the chain
   */
  latest: Block | null

  /**
   * The total difficulty of the blockchain
   */
  td: BN

  /**
   * The height of the blockchain
   */
  height: BN
}

/**
 * Returns properties of the canonical headerchain.
 */
export interface ChainHeaders {
  /**
   * The latest header in the chain
   */
  latest: BlockHeader | null

  /**
   * The total difficulty of the headerchain
   */
  td: BN

  /**
   * The height of the headerchain
   */
  height: BN
}

/**
 * common.genesis() <any> with all values converted to Buffer
 */
export interface GenesisBlockParams {
  [key: string]: Buffer
}

/**
 * Blockchain
 * @memberof module:blockchain
 */
export class Chain extends EventEmitter {
  public config: Config

  public chainDB: LevelUp
  public blockchain: Blockchain
  public opened: boolean

  private _headers: ChainHeaders = {
    latest: null,
    td: new BN(0),
    height: new BN(0),
  }

  private _blocks: ChainBlocks = {
    latest: null,
    td: new BN(0),
    height: new BN(0),
  }

  /**
   * Create new chain
   * @param {ChainOptions} options
   */
  constructor(options: ChainOptions) {
    super()

    this.config = options.config

    this.blockchain =
      options.blockchain ??
      new (Blockchain as any)({
        db: options.chainDB,
        common: this.config.chainCommon,
        validateBlocks: true,
        validateConsensus: false,
      })

    this.chainDB = this.blockchain.db
    this.opened = false
  }

  /**
   * Resets _header, _blocks
   */
  private reset() {
    this._headers = {
      latest: null,
      td: new BN(0),
      height: new BN(0),
    }
    this._blocks = {
      latest: null,
      td: new BN(0),
      height: new BN(0),
    }
  }

  /**
   * Network ID
   */
  get networkId(): BN {
    return this.config.chainCommon.networkIdBN()
  }

  /**
   * Genesis block parameters
   */
  get genesis(): GenesisBlockParams {
    const genesis = this.config.chainCommon.genesis()
    Object.entries(genesis).forEach(([k, v]) => {
      genesis[k] = toBuffer(v as string)
    })
    return genesis
  }

  /**
   * Returns properties of the canonical headerchain.
   * @return {ChainHeaders}
   */
  get headers(): ChainHeaders {
    return { ...this._headers }
  }

  /**
   * Returns properties of the canonical blockchain.
   * @return {ChainBlocks}
   */
  get blocks(): ChainBlocks {
    return { ...this._blocks }
  }

  /**
   * Open blockchain and wait for database to load
   * @return {Promise<boolean|void>} Returns false if chain is already open
   */
  async open(): Promise<boolean | void> {
    if (this.opened) {
      return false
    }
    await (this.blockchain as any)._init()
    await this.blockchain.db.open()
    this.opened = true
    await this.update()
  }

  /**
   * Closes chain
   * @return {Promise<boolean|void>} Returns false if chain is closed
   */
  async close(): Promise<boolean | void> {
    if (!this.opened) {
      return false
    }
    this.reset()
    await this.blockchain.db.close()
    this.opened = false
  }

  /**
   * Update blockchain properties (latest block, td, height, etc...)
   * @return {Promise<boolean|void>} Returns false if chain is closed
   */
  async update(): Promise<boolean | void> {
    if (!this.opened) {
      return false
    }

    const headers: ChainHeaders = {
      latest: null,
      td: new BN(0),
      height: new BN(0),
    }
    const blocks: ChainBlocks = {
      latest: null,
      td: new BN(0),
      height: new BN(0),
    }

    headers.latest = await this.getLatestHeader()
    blocks.latest = await this.getLatestBlock()

    headers.height = headers.latest.number
    blocks.height = blocks.latest.header.number

    headers.td = await this.getTd(headers.latest.hash(), headers.height)
    blocks.td = await this.getTd(blocks.latest.hash(), blocks.height)

    this._headers = headers
    this._blocks = blocks
    this.emit('updated')
  }

  /**
   * Get blocks from blockchain
   * @param  {Buffer | BN}      block   hash or number to start from
   * @param  {number = 1}       max     maximum number of blocks to get
   * @param  {number = 0}       skip    number of blocks to skip
   * @param  {boolean = false}  reverse get blocks in reverse
   * @return {Promise<Block[]>}
   */
  async getBlocks(
    block: Buffer | BN,
    max: number = 1,
    skip: number = 0,
    reverse: boolean = false
  ): Promise<Block[]> {
    await this.open()
    return this.blockchain.getBlocks(block, max, skip, reverse)
  }

  /**
   * Gets a block by its hash or number
   * @param  {Buffer|BN}        block
   * @return {Promise<Block>}
   */
  async getBlock(block: Buffer | BN): Promise<Block> {
    await this.open()
    return this.blockchain.getBlock(block)
  }

  /**
   * Insert new blocks into blockchain
   * @param {Block[]} blocks list of blocks to add
   */
  async putBlocks(blocks: Block[]): Promise<void> {
    if (blocks.length === 0) {
      return
    }
    await this.open()
    blocks = blocks.map((b: Block) =>
      Block.fromValuesArray(b.raw(), {
        common: this.config.chainCommon,
        hardforkByBlockNumber: true,
      })
    )
    await this.blockchain.putBlocks(blocks)
    await this.update()
  }

  /**
   * Get headers from blockchain
   * @param  {Buffer|BN}  block   block hash or number to start from
   * @param  {number}     max     maximum number of headers to get
   * @param  {number}     skip    number of headers to skip
   * @param  {boolean}    reverse get headers in reverse
   * @return {Promise<BlockHeader[]>}
   */
  async getHeaders(
    block: Buffer | BN,
    max: number,
    skip: number,
    reverse: boolean
  ): Promise<BlockHeader[]> {
    const blocks = await this.getBlocks(block, max, skip, reverse)
    return blocks.map((b) => b.header)
  }

  /**
   * Insert new headers into blockchain
   * @param  {BlockHeader[]} headers
   * @return {Promise<void>}
   */
  async putHeaders(headers: BlockHeader[]): Promise<void> {
    if (headers.length === 0) {
      return
    }
    await this.open()
    headers = headers.map((h) =>
      BlockHeader.fromValuesArray(h.raw(), {
        common: this.config.chainCommon,
        hardforkByBlockNumber: true,
      })
    )
    await this.blockchain.putHeaders(headers)
    await this.update()
  }

  /**
   * Gets the latest header in the canonical chain
   * @return {Promise<BlockHeader>}
   */
  async getLatestHeader(): Promise<BlockHeader> {
    await this.open()
    return this.blockchain.getLatestHeader()
  }

  /**
   * Gets the latest block in the canonical chain
   * @return {Promise<Block>}
   */
  async getLatestBlock(): Promise<Block> {
    await this.open()
    return this.blockchain.getLatestBlock()
  }

  /**
   * Gets total difficulty for a block
   * @param  {Buffer}      hash
   * @param  {BN}          num
   * @return {Promise<BN>}
   */
  async getTd(hash: Buffer, num: BN): Promise<BN> {
    await this.open()
    return this.blockchain.getTotalDifficulty(hash, num)
  }
}
