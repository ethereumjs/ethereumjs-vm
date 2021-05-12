import { BN, bufferToInt } from 'ethereumjs-util'
import { BlockHeader, BlockHeaderBuffer } from '@ethereumjs/block'
import { Chain } from './../../blockchain'
import { Message, Protocol, ProtocolOptions } from './protocol'
import { BlockBodyBuffer } from '@ethereumjs/block'

interface EthProtocolOptions extends ProtocolOptions {
  /* Blockchain */
  chain: Chain
}

type GetBlockHeadersOpts = {
  /* The block's number or hash */
  block: BN | Buffer
  /* Max number of blocks to return */
  max: number
  /* Number of blocks to skip apart (default: 0) */
  skip?: number
  /* Fetch blocks in reverse (default: false) */
  reverse?: boolean
}
/*
 * Messages with responses that are added as
 * methods in camelCase to BoundProtocol.
 */
export interface EthProtocolMethods {
  getBlockHeaders: (opts: GetBlockHeadersOpts) => Promise<BlockHeader[]>
  getBlockBodies: (hashes: Buffer[]) => Promise<BlockBodyBuffer[]>
  getNodeData: (hashes: Buffer[]) => Promise<Buffer[]>
}

/**
 * Implements eth/62 and eth/63 protocols
 * @memberof module:net/protocol
 */
export class EthProtocol extends Protocol {
  private chain: Chain

  private protocolMessages: Message[] = [
    {
      name: 'NewBlockHashes',
      code: 0x01,
      encode: (hashes: any[]) => hashes.map((hn) => [hn[0], hn[1].toArrayLike(Buffer)]),
      decode: (hashes: any[]) => hashes.map((hn) => [hn[0], new BN(hn[1])]),
    },
    {
      name: 'GetBlockHeaders',
      code: 0x03,
      response: 0x04,
      encode: ({ block, max, skip = 0, reverse = false }: GetBlockHeadersOpts) => [
        BN.isBN(block) ? block.toArrayLike(Buffer) : block,
        max,
        skip,
        !reverse ? 0 : 1,
      ],
      decode: ([block, max, skip, reverse]: any) => ({
        block: block.length === 32 ? block : new BN(block),
        max: bufferToInt(max),
        skip: bufferToInt(skip),
        reverse: bufferToInt(reverse) === 0 ? false : true,
      }),
    },
    {
      name: 'BlockHeaders',
      code: 0x04,
      encode: (headers: BlockHeader[]) => headers.map((h) => h.raw()),
      decode: (headers: BlockHeaderBuffer[]) => {
        return headers.map((h) =>
          BlockHeader.fromValuesArray(h, {
            hardforkByBlockNumber: true,
            common: this.config.chainCommon, // eslint-disable-line no-invalid-this
          })
        )
      },
    },
    {
      name: 'GetBlockBodies',
      code: 0x05,
      response: 0x06,
    },
    {
      name: 'BlockBodies',
      code: 0x06,
    },
    {
      name: 'GetNodeData',
      code: 0x0d,
      response: 0x0e,
    },
    {
      name: 'NodeData',
      code: 0x0e,
    },
  ]

  /**
   * Create eth protocol
   * @param {EthProtocolOptions}
   */
  constructor(options: EthProtocolOptions) {
    super(options)

    this.chain = options.chain
  }

  /**
   * Name of protocol
   * @type {string}
   */
  get name(): string {
    return 'eth'
  }

  /**
   * Protocol versions supported
   * @type {number[]}
   */
  get versions(): number[] {
    return [65, 64, 63]
  }

  /**
   * Messages defined by this protocol
   * @type {Protocol~Message[]}
   */
  get messages(): Message[] {
    return this.protocolMessages
  }

  /**
   * Opens protocol and any associated dependencies
   * @return {Promise}
   */
  async open(): Promise<boolean | void> {
    if (this.opened) {
      return false
    }
    await this.chain.open()
    this.opened = true
  }

  /**
   * Encodes status into ETH status message payload
   * @return {Object}
   */
  encodeStatus(): any {
    // TODO: add latestBlock for more precise ETH/64 forkhash switch
    return {
      networkId: this.chain.networkId.toArrayLike(Buffer),
      td: this.chain.blocks.td.toArrayLike(Buffer),
      bestHash: this.chain.blocks.latest!.hash(),
      genesisHash: this.chain.genesis.hash,
    }
  }

  /**
   * Decodes ETH status message payload into a status object
   * @param {Object} status status message payload
   * @return {Object}
   */
  decodeStatus(status: any): any {
    return {
      networkId: new BN(status.networkId),
      td: new BN(status.td),
      bestHash: status.bestHash,
      genesisHash: status.genesisHash,
    }
  }
}
