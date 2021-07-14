import { BN } from 'ethereumjs-util'
import { Chain } from './../../blockchain'
import { Message, Protocol, ProtocolOptions } from './protocol'

export interface WitProtocolOptions extends ProtocolOptions {
  /* Blockchain */
  chain: Chain
}

type GetBlockWitnessHashesOpts = {
  /* Request id (default: next internal id) */
  reqId?: BN
  /* Hash of the block to request the witness hashes for */
  blockHash: Buffer
}
/*
 * Messages with responses that are added as
 * methods in camelCase to BoundProtocol.
 */
export interface WitProtocolMethods {
  getBlockWitnessHashes: (opts: GetBlockWitnessHashesOpts) => Promise<[BN, Buffer[]]>
}

const id = new BN(0)

/**
 * Implements wit/0 protocol
 * @memberof module:net/protocol
 */
export class WitProtocol extends Protocol {
  private chain: Chain

  private protocolMessages: Message[] = [
    {
      name: 'GetBlockWitnessHashes',
      code: 0x01,
      response: 0x02,
      encode: ({ reqId, blockHash }: GetBlockWitnessHashesOpts) => [
        (reqId === undefined ? id.iaddn(1) : new BN(reqId)).toArrayLike(Buffer),
        blockHash,
      ],
      decode: ([reqId, blockHash]: any) => ({ reqId: new BN(reqId), blockHash }),
    },
    {
      name: 'BlockWitnessHashes',
      code: 0x02,
      encode: ({ reqId, witnessHashes }: any) => [new BN(reqId).toArrayLike(Buffer), witnessHashes],
      decode: ([reqId, witnessHashes]: any) => [new BN(reqId), witnessHashes],
    },
  ]

  /**
   * Create wit protocol
   * @param {WitProtocolOptions}
   */
  constructor(options: WitProtocolOptions) {
    super(options)

    this.chain = options.chain
  }

  /**
   * Name of protocol
   * @type {string}
   */
  get name(): string {
    return 'wit'
  }

  /**
   * Protocol versions supported
   * @type {number[]}
   */
  get versions(): number[] {
    return [0]
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
}
