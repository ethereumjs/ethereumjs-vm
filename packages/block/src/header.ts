import Common from '@ethereumjs/common'
import {
  Address,
  BN,
  bnToHex,
  bnToUnpaddedBuffer,
  ecrecover,
  ecsign,
  intToBuffer,
  KECCAK256_RLP_ARRAY,
  KECCAK256_RLP,
  rlp,
  rlphash,
  toBuffer,
  zeros,
} from 'ethereumjs-util'
import { HeaderData, JsonHeader, BlockHeaderBuffer, Blockchain, BlockOptions } from './types'
import {
  CLIQUE_EXTRA_VANITY,
  CLIQUE_EXTRA_SEAL,
  CLIQUE_DIFF_INTURN,
  CLIQUE_DIFF_NOTURN,
} from './clique'

const DEFAULT_GAS_LIMIT = new BN(Buffer.from('ffffffffffffff', 'hex'))

/**
 * An object that represents the block header.
 */
export class BlockHeader {
  public readonly parentHash: Buffer
  public readonly uncleHash: Buffer
  public readonly coinbase: Address
  public readonly stateRoot: Buffer
  public readonly transactionsTrie: Buffer
  public readonly receiptTrie: Buffer
  public readonly bloom: Buffer
  public readonly difficulty: BN
  public readonly number: BN
  public readonly gasLimit: BN
  public readonly gasUsed: BN
  public readonly timestamp: BN
  public readonly extraData: Buffer
  public readonly mixHash: Buffer
  public readonly nonce: Buffer
  public readonly baseFeePerGas?: BN

  public readonly _common: Common
  public _errorPostfix = ''

  /**
   * Static constructor to create a block header from a header data dictionary
   *
   * @param headerData
   * @param opts
   */
  public static fromHeaderData(headerData: HeaderData = {}, opts: BlockOptions = {}) {
    const {
      parentHash,
      uncleHash,
      coinbase,
      stateRoot,
      transactionsTrie,
      receiptTrie,
      bloom,
      difficulty,
      number,
      gasLimit,
      gasUsed,
      timestamp,
      extraData,
      mixHash,
      nonce,
      baseFeePerGas,
    } = headerData

    return new BlockHeader(
      parentHash ? toBuffer(parentHash) : zeros(32),
      uncleHash ? toBuffer(uncleHash) : KECCAK256_RLP_ARRAY,
      coinbase ? new Address(toBuffer(coinbase)) : Address.zero(),
      stateRoot ? toBuffer(stateRoot) : zeros(32),
      transactionsTrie ? toBuffer(transactionsTrie) : KECCAK256_RLP,
      receiptTrie ? toBuffer(receiptTrie) : KECCAK256_RLP,
      bloom ? toBuffer(bloom) : zeros(256),
      difficulty ? new BN(toBuffer(difficulty)) : new BN(0),
      number ? new BN(toBuffer(number)) : new BN(0),
      gasLimit ? new BN(toBuffer(gasLimit)) : DEFAULT_GAS_LIMIT,
      gasUsed ? new BN(toBuffer(gasUsed)) : new BN(0),
      timestamp ? new BN(toBuffer(timestamp)) : new BN(0),
      extraData ? toBuffer(extraData) : Buffer.from([]),
      mixHash ? toBuffer(mixHash) : zeros(32),
      nonce ? toBuffer(nonce) : zeros(8),
      opts,
      baseFeePerGas !== undefined ? new BN(toBuffer(baseFeePerGas)) : undefined
    )
  }

  /**
   * Static constructor to create a block header from a RLP-serialized header
   *
   * @param headerData
   * @param opts
   */
  public static fromRLPSerializedHeader(serialized: Buffer, opts: BlockOptions = {}) {
    const values = rlp.decode(serialized)

    if (!Array.isArray(values)) {
      throw new Error('Invalid serialized header input. Must be array')
    }

    return BlockHeader.fromValuesArray(values, opts)
  }

  /**
   * Static constructor to create a block header from an array of Buffer values
   *
   * @param headerData
   * @param opts
   */
  public static fromValuesArray(values: BlockHeaderBuffer, opts: BlockOptions = {}) {
    const [
      parentHash,
      uncleHash,
      coinbase,
      stateRoot,
      transactionsTrie,
      receiptTrie,
      bloom,
      difficulty,
      number,
      gasLimit,
      gasUsed,
      timestamp,
      extraData,
      mixHash,
      nonce,
      baseFeePerGas,
    ] = values

    if (values.length > 16) {
      throw new Error('invalid header. More values than expected were received')
    }
    if (values.length < 15) {
      throw new Error('invalid header. Less values than expected were received')
    }

    return new BlockHeader(
      toBuffer(parentHash),
      toBuffer(uncleHash),
      new Address(toBuffer(coinbase)),
      toBuffer(stateRoot),
      toBuffer(transactionsTrie),
      toBuffer(receiptTrie),
      toBuffer(bloom),
      new BN(toBuffer(difficulty)),
      new BN(toBuffer(number)),
      new BN(toBuffer(gasLimit)),
      new BN(toBuffer(gasUsed)),
      new BN(toBuffer(timestamp)),
      toBuffer(extraData),
      toBuffer(mixHash),
      toBuffer(nonce),
      opts,
      baseFeePerGas !== undefined ? new BN(toBuffer(baseFeePerGas)) : undefined
    )
  }

  /**
   * Alias for {@link BlockHeader.fromHeaderData} with {@link BlockOptions.initWithGenesisHeader} set to true.
   */
  public static genesis(headerData: HeaderData = {}, opts?: BlockOptions) {
    opts = { ...opts, initWithGenesisHeader: true }
    return BlockHeader.fromHeaderData(headerData, opts)
  }

  /**
   * This constructor takes the values, validates them, assigns them and freezes the object.
   *
   * @deprecated - Use the public static factory methods to assist in creating a Header object from
   * varying data types. For a default empty header, use {@link BlockHeader.fromHeaderData}.
   *
   */
  constructor(
    parentHash: Buffer,
    uncleHash: Buffer,
    coinbase: Address,
    stateRoot: Buffer,
    transactionsTrie: Buffer,
    receiptTrie: Buffer,
    bloom: Buffer,
    difficulty: BN,
    number: BN,
    gasLimit: BN,
    gasUsed: BN,
    timestamp: BN,
    extraData: Buffer,
    mixHash: Buffer,
    nonce: Buffer,
    options: BlockOptions = {},
    baseFeePerGas?: BN
  ) {
    if (options.common) {
      this._common = options.common.copy()
    } else {
      const chain = 'mainnet' // default
      if (options.initWithGenesisHeader) {
        this._common = new Common({ chain, hardfork: 'chainstart' })
      } else {
        // This initializes on the Common default hardfork
        this._common = new Common({ chain })
      }
    }

    if (options.hardforkByBlockNumber) {
      this._common.setHardforkByBlockNumber(number.toNumber())
    }

    if (this._common.isActivatedEIP(1559)) {
      if (baseFeePerGas === undefined) {
        baseFeePerGas = new BN(7)
      }
    } else {
      if (baseFeePerGas) {
        throw new Error('A base fee for a block can only be set with EIP1559 being activated')
      }
    }

    if (options.initWithGenesisHeader) {
      number = new BN(0)
      if (gasLimit.eq(DEFAULT_GAS_LIMIT)) {
        gasLimit = new BN(toBuffer(this._common.genesis().gasLimit))
      }
      if (timestamp.isZero()) {
        timestamp = new BN(toBuffer(this._common.genesis().timestamp))
      }
      if (difficulty.isZero()) {
        difficulty = new BN(toBuffer(this._common.genesis().difficulty))
      }
      if (extraData.length === 0) {
        extraData = toBuffer(this._common.genesis().extraData)
      }
      if (nonce.equals(zeros(8))) {
        nonce = toBuffer(this._common.genesis().nonce)
      }
      if (stateRoot.equals(zeros(32))) {
        stateRoot = toBuffer(this._common.genesis().stateRoot)
      }
    }

    this.parentHash = parentHash
    this.uncleHash = uncleHash
    this.coinbase = coinbase
    this.stateRoot = stateRoot
    this.transactionsTrie = transactionsTrie
    this.receiptTrie = receiptTrie
    this.bloom = bloom
    this.difficulty = difficulty
    this.number = number
    this.gasLimit = gasLimit
    this.gasUsed = gasUsed
    this.timestamp = timestamp
    this.extraData = extraData
    this.mixHash = mixHash
    this.nonce = nonce
    this.baseFeePerGas = baseFeePerGas

    this._validateHeaderFields()
    this._checkDAOExtraData()

    // Now we have set all the values of this Header, we possibly have set a dummy
    // `difficulty` value (defaults to 0). If we have a `calcDifficultyFromHeader`
    // block option parameter, we instead set difficulty to this value.
    if (options.calcDifficultyFromHeader) {
      this.difficulty = this.canonicalDifficulty(options.calcDifficultyFromHeader)
    }

    // If cliqueSigner is provided, seal block with provided privateKey.
    if (options.cliqueSigner) {
      // Ensure extraData is at least length CLIQUE_EXTRA_VANITY + CLIQUE_EXTRA_SEAL
      const minExtraDataLength = CLIQUE_EXTRA_VANITY + CLIQUE_EXTRA_SEAL
      if (this.extraData.length < minExtraDataLength) {
        const remainingLength = minExtraDataLength - this.extraData.length
        this.extraData = Buffer.concat([this.extraData, Buffer.alloc(remainingLength)])
      }

      this.extraData = this.cliqueSealBlock(options.cliqueSigner)
    }

    this._errorPostfix = `block number=${this.number.toNumber()} hash=${this.hash().toString(
      'hex'
    )}`

    const freeze = options?.freeze ?? true
    if (freeze) {
      Object.freeze(this)
    }
  }

  /**
   * Validates correct buffer lengths, throws if invalid.
   */
  _validateHeaderFields() {
    const { parentHash, stateRoot, transactionsTrie, receiptTrie, mixHash, nonce } = this

    if (parentHash.length !== 32) {
      throw new Error(`parentHash must be 32 bytes, received ${parentHash.length} bytes`)
    }
    if (stateRoot.length !== 32) {
      throw new Error(`stateRoot must be 32 bytes, received ${stateRoot.length} bytes`)
    }
    if (transactionsTrie.length !== 32) {
      throw new Error(
        `transactionsTrie must be 32 bytes, received ${transactionsTrie.length} bytes`
      )
    }
    if (receiptTrie.length !== 32) {
      throw new Error(`receiptTrie must be 32 bytes, received ${receiptTrie.length} bytes`)
    }
    if (mixHash.length !== 32) {
      throw new Error(`mixHash must be 32 bytes, received ${mixHash.length} bytes`)
    }

    if (nonce.length !== 8) {
      // Hack to check for Kovan due to non-standard nonce length (65 bytes)
      if (this._common.networkIdBN().eqn(42)) {
        if (nonce.length !== 65) {
          throw new Error(`nonce must be 65 bytes on kovan, received ${nonce.length} bytes`)
        }
      } else {
        throw new Error(`nonce must be 8 bytes, received ${nonce.length} bytes`)
      }
    }
  }

  /**
   * Returns the canonical difficulty for this block.
   *
   * @param parentBlockHeader - the header from the parent `Block` of this header
   */
  canonicalDifficulty(parentBlockHeader: BlockHeader): BN {
    if (this._common.consensusType() !== 'pow') {
      throw new Error('difficulty calculation is only supported on PoW chains')
    }
    if (this._common.consensusAlgorithm() !== 'ethash') {
      throw new Error('difficulty calculation currently only supports the ethash algorithm')
    }
    const hardfork = this._getHardfork()
    const blockTs = this.timestamp
    const { timestamp: parentTs, difficulty: parentDif } = parentBlockHeader
    const minimumDifficulty = new BN(
      this._common.paramByHardfork('pow', 'minimumDifficulty', hardfork)
    )
    const offset = parentDif.div(
      new BN(this._common.paramByHardfork('pow', 'difficultyBoundDivisor', hardfork))
    )
    let num = this.number.clone()

    // We use a ! here as TS cannot follow this hardfork-dependent logic, but it always gets assigned
    let dif!: BN

    if (this._common.hardforkGteHardfork(hardfork, 'byzantium')) {
      // max((2 if len(parent.uncles) else 1) - ((timestamp - parent.timestamp) // 9), -99) (EIP100)
      const uncleAddend = parentBlockHeader.uncleHash.equals(KECCAK256_RLP_ARRAY) ? 1 : 2
      let a = blockTs.sub(parentTs).idivn(9).ineg().iaddn(uncleAddend)
      const cutoff = new BN(-99)
      // MAX(cutoff, a)
      if (cutoff.gt(a)) {
        a = cutoff
      }
      dif = parentDif.add(offset.mul(a))
    }

    if (this._common.hardforkGteHardfork(hardfork, 'byzantium')) {
      // Get delay as parameter from common
      num.isubn(this._common.param('pow', 'difficultyBombDelay'))
      if (num.ltn(0)) {
        num = new BN(0)
      }
    } else if (this._common.hardforkGteHardfork(hardfork, 'homestead')) {
      // 1 - (block_timestamp - parent_timestamp) // 10
      let a = blockTs.sub(parentTs).idivn(10).ineg().iaddn(1)
      const cutoff = new BN(-99)
      // MAX(cutoff, a)
      if (cutoff.gt(a)) {
        a = cutoff
      }
      dif = parentDif.add(offset.mul(a))
    } else {
      // pre-homestead
      if (
        parentTs.addn(this._common.paramByHardfork('pow', 'durationLimit', hardfork)).gt(blockTs)
      ) {
        dif = offset.add(parentDif)
      } else {
        dif = parentDif.sub(offset)
      }
    }

    const exp = num.divn(100000).isubn(2)
    if (!exp.isNeg()) {
      dif.iadd(new BN(2).pow(exp))
    }

    if (dif.lt(minimumDifficulty)) {
      dif = minimumDifficulty
    }

    return dif
  }

  /**
   * Checks that the block's `difficulty` matches the canonical difficulty.
   *
   * @param parentBlockHeader - the header from the parent `Block` of this header
   */
  validateDifficulty(parentBlockHeader: BlockHeader): boolean {
    return this.canonicalDifficulty(parentBlockHeader).eq(this.difficulty)
  }

  /**
   * For poa, validates `difficulty` is correctly identified as INTURN or NOTURN.
   * Returns false if invalid.
   */
  validateCliqueDifficulty(blockchain: Blockchain): boolean {
    this._requireClique('validateCliqueDifficulty')
    if (!this.difficulty.eq(CLIQUE_DIFF_INTURN) && !this.difficulty.eq(CLIQUE_DIFF_NOTURN)) {
      throw new Error(
        `difficulty for clique block must be INTURN (2) or NOTURN (1), received: ${this.difficulty.toString()}`
      )
    }
    if ('cliqueActiveSigners' in blockchain === false) {
      throw new Error(
        'PoA blockchain requires method blockchain.cliqueActiveSigners() to validate clique difficulty'
      )
    }
    const signers = (blockchain as any).cliqueActiveSigners()
    if (signers.length === 0) {
      // abort if signers are unavailable
      return true
    }
    const signerIndex = signers.findIndex((address: Address) => address.equals(this.cliqueSigner()))
    const inTurn = this.number.modn(signers.length) === signerIndex
    if (
      (inTurn && this.difficulty.eq(CLIQUE_DIFF_INTURN)) ||
      (!inTurn && this.difficulty.eq(CLIQUE_DIFF_NOTURN))
    ) {
      return true
    }
    return false
  }

  /**
   * Validates if the block gasLimit remains in the
   * boundaries set by the protocol.
   *
   * @param parentBlockHeader - the header from the parent `Block` of this header
   */
  validateGasLimit(parentBlockHeader: BlockHeader): boolean {
    let parentGasLimit = parentBlockHeader.gasLimit
    // EIP-1559: assume double the parent gas limit on fork block
    // to adopt to the new gas target centered logic
    const londonHardforkBlock = this._common.hardforkBlockBN('london')
    if (londonHardforkBlock && this.number.eq(londonHardforkBlock)) {
      const elasticity = new BN(this._common.param('gasConfig', 'elasticityMultiplier'))
      parentGasLimit = parentGasLimit.mul(elasticity)
    }
    const gasLimit = this.gasLimit
    const hardfork = this._getHardfork()

    const a = parentGasLimit.div(
      new BN(this._common.paramByHardfork('gasConfig', 'gasLimitBoundDivisor', hardfork))
    )
    const maxGasLimit = parentGasLimit.add(a)
    const minGasLimit = parentGasLimit.sub(a)

    const result =
      gasLimit.lt(maxGasLimit) &&
      gasLimit.gt(minGasLimit) &&
      gasLimit.gte(this._common.paramByHardfork('gasConfig', 'minGasLimit', hardfork))

    return result
  }

  /**
   * Validates the block header, throwing if invalid. It is being validated against the reported `parentHash`.
   * It verifies the current block against the `parentHash`:
   * - The `parentHash` is part of the blockchain (it is a valid header)
   * - Current block number is parent block number + 1
   * - Current block has a strictly higher timestamp
   * - Additional PoW checks ->
   *   - Current block has valid difficulty and gas limit
   *   - In case that the header is an uncle header, it should not be too old or young in the chain.
   * - Additional PoA clique checks ->
   *   - Various extraData checks
   *   - Checks on coinbase and mixHash
   *   - Current block has a timestamp diff greater or equal to PERIOD
   *   - Current block has difficulty correctly marked as INTURN or NOTURN
   * @param blockchain - validate against an @ethereumjs/blockchain
   * @param height - If this is an uncle header, this is the height of the block that is including it
   */
  async validate(blockchain: Blockchain, height?: BN): Promise<void> {
    if (this.isGenesis()) {
      return
    }
    const hardfork = this._getHardfork()
    // Consensus type dependent checks
    if (this._common.consensusAlgorithm() !== 'clique') {
      // PoW/Ethash
      if (
        this.extraData.length > this._common.paramByHardfork('vm', 'maxExtraDataSize', hardfork)
      ) {
        const msg = 'invalid amount of extra data'
        throw this._error(msg)
      }
    } else {
      // PoA/Clique
      const minLength = CLIQUE_EXTRA_VANITY + CLIQUE_EXTRA_SEAL
      if (!this.cliqueIsEpochTransition()) {
        // ExtraData length on epoch transition
        if (this.extraData.length !== minLength) {
          const msg = `extraData must be ${minLength} bytes on non-epoch transition blocks, received ${this.extraData.length} bytes`
          throw this._error(msg)
        }
      } else {
        const signerLength = this.extraData.length - minLength
        if (signerLength % 20 !== 0) {
          const msg = `invalid signer list length in extraData, received signer length of ${signerLength} (not divisible by 20)`
          throw this._error(msg)
        }
        // coinbase (beneficiary) on epoch transition
        if (!this.coinbase.isZero()) {
          const msg = `coinbase must be filled with zeros on epoch transition blocks, received ${this.coinbase.toString()}`
          throw this._error(msg)
        }
      }
      // MixHash format
      if (!this.mixHash.equals(Buffer.alloc(32))) {
        const msg = `mixHash must be filled with zeros, received ${this.mixHash}`
        throw this._error(msg)
      }
      if (!this.validateCliqueDifficulty(blockchain)) {
        const msg = `invalid clique difficulty`
        throw this._error(msg)
      }
    }

    const parentHeader = await this._getHeaderByHash(blockchain, this.parentHash)

    if (!parentHeader) {
      throw new Error('could not find parent header')
    }

    const { number } = this
    if (!number.eq(parentHeader.number.addn(1))) {
      throw new Error('invalid number')
    }

    if (this.timestamp.lte(parentHeader.timestamp)) {
      throw new Error('invalid timestamp')
    }

    if (this._common.consensusAlgorithm() === 'clique') {
      const period = this._common.consensusConfig().period
      // Timestamp diff between blocks is lower than PERIOD (clique)
      if (parentHeader.timestamp.addn(period).gt(this.timestamp)) {
        throw new Error('invalid timestamp diff (lower than period)')
      }
    }

    if (this._common.consensusType() === 'pow') {
      if (!this.validateDifficulty(parentHeader)) {
        throw new Error('invalid difficulty')
      }
    }

    if (!this.validateGasLimit(parentHeader)) {
      throw new Error('invalid gas limit')
    }

    if (height) {
      const dif = height.sub(parentHeader.number)
      if (!(dif.ltn(8) && dif.gtn(1))) {
        throw new Error('uncle block has a parent that is too old or too young')
      }
    }

    // check if the block used too much gas
    if (this.gasUsed.gt(this.gasLimit)) {
      throw new Error('Invalid block: too much gas used')
    }

    if (this._common.isActivatedEIP(1559)) {
      if (!this.baseFeePerGas) {
        throw new Error('EIP1559 block has no base fee field')
      }
      const block = this._common.hardforkBlockBN('london')
      const isInitialEIP1559Block = block && this.number.eq(block)
      if (isInitialEIP1559Block) {
        const initialBaseFee = new BN(this._common.param('gasConfig', 'initialBaseFee'))
        if (!this.baseFeePerGas!.eq(initialBaseFee)) {
          throw new Error('Initial EIP1559 block does not have initial base fee')
        }
      } else {
        // check if the base fee is correct
        const expectedBaseFee = parentHeader.calcNextBaseFee()

        if (!this.baseFeePerGas!.eq(expectedBaseFee)) {
          throw new Error('Invalid block: base fee not correct')
        }
      }
    }
  }

  /**
   * Calculates the base fee for a potential next block
   */
  public calcNextBaseFee(): BN {
    if (!this._common.isActivatedEIP(1559)) {
      throw new Error('calcNextBaseFee() can only be called with EIP1559 being activated')
    }
    let nextBaseFee: BN
    const elasticity = new BN(this._common.param('gasConfig', 'elasticityMultiplier'))
    const parentGasTarget = this.gasLimit.div(elasticity)

    if (parentGasTarget.eq(this.gasUsed)) {
      nextBaseFee = this.baseFeePerGas!
    } else if (this.gasUsed.gt(parentGasTarget)) {
      const gasUsedDelta = this.gasUsed.sub(parentGasTarget)
      const baseFeeMaxChangeDenominator = new BN(
        this._common.param('gasConfig', 'baseFeeMaxChangeDenominator')
      )
      const calculatedDelta = this.baseFeePerGas!.mul(gasUsedDelta)
        .div(parentGasTarget)
        .div(baseFeeMaxChangeDenominator)
      nextBaseFee = BN.max(calculatedDelta, new BN(1)).add(this.baseFeePerGas!)
    } else {
      const gasUsedDelta = parentGasTarget.sub(this.gasUsed)
      const baseFeeMaxChangeDenominator = new BN(
        this._common.param('gasConfig', 'baseFeeMaxChangeDenominator')
      )
      const calculatedDelta = this.baseFeePerGas!.mul(gasUsedDelta)
        .div(parentGasTarget)
        .div(baseFeeMaxChangeDenominator)
      nextBaseFee = BN.max(this.baseFeePerGas!.sub(calculatedDelta), new BN(0))
    }
    return nextBaseFee
  }

  /**
   * Returns a Buffer Array of the raw Buffers in this header, in order.
   */
  raw(): BlockHeaderBuffer {
    const rawItems = [
      this.parentHash,
      this.uncleHash,
      this.coinbase.buf,
      this.stateRoot,
      this.transactionsTrie,
      this.receiptTrie,
      this.bloom,
      bnToUnpaddedBuffer(this.difficulty),
      bnToUnpaddedBuffer(this.number),
      bnToUnpaddedBuffer(this.gasLimit),
      bnToUnpaddedBuffer(this.gasUsed),
      bnToUnpaddedBuffer(this.timestamp),
      this.extraData,
      this.mixHash,
      this.nonce,
    ]

    if (this._common.isActivatedEIP(1559)) {
      rawItems.push(bnToUnpaddedBuffer(this.baseFeePerGas!))
    }

    return rawItems
  }

  /**
   * Returns the hash of the block header.
   */
  hash(): Buffer {
    return rlphash(this.raw())
  }

  /**
   * Checks if the block header is a genesis header.
   */
  isGenesis(): boolean {
    return this.number.isZero()
  }

  private _requireClique(name: string) {
    if (this._common.consensusAlgorithm() !== 'clique') {
      throw new Error(`BlockHeader.${name}() call only supported for clique PoA networks`)
    }
  }

  /**
   * PoA clique signature hash without the seal.
   */
  cliqueSigHash() {
    this._requireClique('cliqueSigHash')
    const raw = this.raw()
    raw[12] = this.extraData.slice(0, this.extraData.length - CLIQUE_EXTRA_SEAL)
    return rlphash(raw)
  }

  /**
   * Checks if the block header is an epoch transition
   * header (only clique PoA, throws otherwise)
   */
  cliqueIsEpochTransition(): boolean {
    this._requireClique('cliqueIsEpochTransition')
    const epoch = new BN(this._common.consensusConfig().epoch)
    // Epoch transition block if the block number has no
    // remainder on the division by the epoch length
    return this.number.mod(epoch).isZero()
  }

  /**
   * Returns extra vanity data
   * (only clique PoA, throws otherwise)
   */
  cliqueExtraVanity(): Buffer {
    this._requireClique('cliqueExtraVanity')
    return this.extraData.slice(0, CLIQUE_EXTRA_VANITY)
  }

  /**
   * Returns extra seal data
   * (only clique PoA, throws otherwise)
   */
  cliqueExtraSeal(): Buffer {
    this._requireClique('cliqueExtraSeal')
    return this.extraData.slice(-CLIQUE_EXTRA_SEAL)
  }

  /**
   * Seal block with the provided signer.
   * Returns the final extraData field to be assigned to `this.extraData`.
   * @hidden
   */
  private cliqueSealBlock(privateKey: Buffer) {
    this._requireClique('cliqueSealBlock')

    const signature = ecsign(this.cliqueSigHash(), privateKey)
    const signatureB = Buffer.concat([signature.r, signature.s, intToBuffer(signature.v - 27)])

    const extraDataWithoutSeal = this.extraData.slice(0, this.extraData.length - CLIQUE_EXTRA_SEAL)
    const extraData = Buffer.concat([extraDataWithoutSeal, signatureB])
    return extraData
  }

  /**
   * Returns a list of signers
   * (only clique PoA, throws otherwise)
   *
   * This function throws if not called on an epoch
   * transition block and should therefore be used
   * in conjunction with {@link BlockHeader.cliqueIsEpochTransition}
   */
  cliqueEpochTransitionSigners(): Address[] {
    this._requireClique('cliqueEpochTransitionSigners')
    if (!this.cliqueIsEpochTransition()) {
      throw new Error('Signers are only included in epoch transition blocks (clique)')
    }

    const start = CLIQUE_EXTRA_VANITY
    const end = this.extraData.length - CLIQUE_EXTRA_SEAL
    const signerBuffer = this.extraData.slice(start, end)

    const signerList: Buffer[] = []
    const signerLength = 20
    for (let start = 0; start <= signerBuffer.length - signerLength; start += signerLength) {
      signerList.push(signerBuffer.slice(start, start + signerLength))
    }
    return signerList.map((buf) => new Address(buf))
  }

  /**
   * Verifies the signature of the block (last 65 bytes of extraData field)
   * (only clique PoA, throws otherwise)
   *
   *  Method throws if signature is invalid
   */
  cliqueVerifySignature(signerList: Address[]): boolean {
    this._requireClique('cliqueVerifySignature')
    const signerAddress = this.cliqueSigner()
    const signerFound = signerList.find((signer) => {
      return signer.equals(signerAddress)
    })
    return !!signerFound
  }

  /**
   * Returns the signer address
   */
  cliqueSigner(): Address {
    this._requireClique('cliqueSigner')
    const extraSeal = this.cliqueExtraSeal()
    // Reasonable default for default blocks
    if (extraSeal.length === 0) {
      return Address.zero()
    }
    const r = extraSeal.slice(0, 32)
    const s = extraSeal.slice(32, 64)
    const v = new BN(extraSeal.slice(64, 65)).addn(27)
    const pubKey = ecrecover(this.cliqueSigHash(), v, r, s)
    return Address.fromPublicKey(pubKey)
  }

  /**
   * Returns the rlp encoding of the block header.
   */
  serialize(): Buffer {
    return rlp.encode(this.raw())
  }

  /**
   * Returns the block header in JSON format.
   */
  toJSON(): JsonHeader {
    const jsonDict: JsonHeader = {
      parentHash: '0x' + this.parentHash.toString('hex'),
      uncleHash: '0x' + this.uncleHash.toString('hex'),
      coinbase: this.coinbase.toString(),
      stateRoot: '0x' + this.stateRoot.toString('hex'),
      transactionsTrie: '0x' + this.transactionsTrie.toString('hex'),
      receiptTrie: '0x' + this.receiptTrie.toString('hex'),
      bloom: '0x' + this.bloom.toString('hex'),
      difficulty: bnToHex(this.difficulty),
      number: bnToHex(this.number),
      gasLimit: bnToHex(this.gasLimit),
      gasUsed: bnToHex(this.gasUsed),
      timestamp: bnToHex(this.timestamp),
      extraData: '0x' + this.extraData.toString('hex'),
      mixHash: '0x' + this.mixHash.toString('hex'),
      nonce: '0x' + this.nonce.toString('hex'),
    }
    if (this._common.isActivatedEIP(1559)) {
      jsonDict['baseFee'] = '0x' + this.baseFeePerGas!.toString('hex')
    }

    return jsonDict
  }

  /**
   * Internal helper function to create an annotated error message
   *
   * @param msg Base error message
   * @hidden
   */
  _error(msg: string) {
    msg += ` (${this._errorPostfix})`
    const e = new Error(msg)
    return e
  }

  private _getHardfork(): string {
    return this._common.hardfork() || this._common.activeHardfork(this.number.toNumber())
  }

  private async _getHeaderByHash(
    blockchain: Blockchain,
    hash: Buffer
  ): Promise<BlockHeader | undefined> {
    try {
      const header = (await blockchain.getBlock(hash)).header
      return header
    } catch (error) {
      if (error.type === 'NotFoundError') {
        return undefined
      } else {
        throw error
      }
    }
  }

  /**
   * Force extra data be DAO_ExtraData for DAO_ForceExtraDataRange blocks after DAO
   * activation block (see: https://blog.slock.it/hard-fork-specification-24b889e70703)
   */
  private _checkDAOExtraData() {
    const DAO_ExtraData = Buffer.from('64616f2d686172642d666f726b', 'hex')
    const DAO_ForceExtraDataRange = new BN(9)

    if (this._common.hardforkIsActiveOnChain('dao')) {
      // verify the extraData field.
      const blockNumber = this.number
      const DAOActivationBlock = this._common.hardforkBlockBN('dao')!
      if (blockNumber.gte(DAOActivationBlock)) {
        const drift = blockNumber.sub(DAOActivationBlock)
        if (drift.lte(DAO_ForceExtraDataRange)) {
          if (!this.extraData.equals(DAO_ExtraData)) {
            throw new Error("extraData should be 'dao-hard-fork'")
          }
        }
      }
    }
  }
}
