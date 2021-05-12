import { BN, generateAddress, toBuffer } from 'ethereumjs-util'
import { Peer } from '../net/peer/peer'
import { short } from '../util'
import { Synchronizer, SynchronizerOptions } from './sync'
import { BlockFetcher } from './fetcher'
import { Block } from '@ethereumjs/block'
import { VMExecution } from './execution/vmexecution'
import { SecureTrie } from 'merkle-patricia-tree'
import { keccak256 } from '@ethereumjs/devp2p'
import { AfterTxEvent } from '@ethereumjs/vm/dist/runTx'
import { TypedTransaction } from '@ethereumjs/tx'
const level = require('level')

const ENCODING_OPTS = { keyEncoding: 'binary', valueEncoding: 'binary' }

// Minimum number of blocks to stay behind tip of chain to avoid syncing reorged blocks
const PIVOT_BLOCKS = 20

export class BeamSyncDB extends level {
  constructor(...args: any) {
    console.log('beam sync db')
    super(...args)
  }

  testfn() {
    console.log('hey')
  }

  async get(node: Buffer) {
    console.log('GET', node.toString('hex'))
    try {
      return await super.get(node)
    } catch (e) {
      console.log('threw.')
      throw e
    }
  }
}

/**
 * Implements an ethereum full sync synchronizer
 * @memberof module:sync
 */
export class BeamSynchronizer extends Synchronizer {
  private blockFetcher: BlockFetcher | null

  public hardfork: string = ''
  public execution: VMExecution

  private syncPeer?: Peer

  constructor(options: SynchronizerOptions) {
    super(options)
    this.blockFetcher = null

    const db = new level(options.config.getStateDataDirectory('beamsync'))
    // TODO: figure out why BeamSyncDB does not correctly overrie get
    const oldGet = db.get
    const synchronizer = this
    let hits = 0
    let misses = 0
    let getNodeTime = 0
    db.get = async function (node: Buffer) {
      //console.log('get', node.toString('hex'))
      try {
        const result = await oldGet.apply(this, [node, ENCODING_OPTS])
        hits++
        //console.log('is in db', result.toString('hex'))
        return result
      } catch (e) {
        if (e.notFound) {
          misses++
          //console.log('getting node data!', node.toString('hex'))
          const time = Date.now() / 1000
          // eslint-disable-next-line no-async-promise-executor
          const result = await new Promise(async (resolve, reject) => {
            for (let i = 0; i < 50; i++) {
              const result = await synchronizer.syncPeer!.eth?.getNodeData([node])
              //console.log('got result!')
              if (result) {
                // ensure we got the correct node
                //console.log(result.length)
                for (const reportedNode of result) {
                  //console.log('checking...', reportedNode.toString('hex'))
                  if (keccak256(reportedNode).equals(node)) {
                    //console.log('found node!')
                    await db.put(node as Buffer, reportedNode as Buffer, ENCODING_OPTS)
                    getNodeTime += Date.now() / 1000 - time
                    resolve(reportedNode)
                    return
                  }
                }
              }
            }
            // TODO: use PeerPool to try another peer.
            reject('Tried to get node more than 50 times')
          })
          return result
        } else {
          throw e
        }
      }
    }
    const trie = new SecureTrie(db)

    this.execution = new VMExecution({
      config: options.config,
      stateDB: options.stateDB,
      chain: options.chain,
      trie,
    })

    const oldGetHeader = this.execution.vm.blockchain.getHeader

    this.execution.vm.blockchain.getHeader = async function (blockId: Buffer | number | BN) {
      try {
        return await oldGetHeader.apply(this, [blockId])
      } catch (e) {
        if (e.notFound) {
          let block
          if (typeof blockId === 'number') {
            block = new BN(blockId)
          } else {
            block = blockId
          }
          for (let i = 0; i < 50; i++) {
            await synchronizer.syncPeer?.eth?.getBlockHeaders({
              block,
              max: 1,
            })
          }
          throw 'Tried to get header more than 50 times'
        } else {
          throw e
        }
      }
    }

    let txs = 0
    const runTime = Date.now() / 1000
    let gas = 0

    this.execution.vm.on('afterTx', (result: AfterTxEvent) => {
      gas += result.gasUsed.toNumber()
      txs++
      console.log(
        'ran tx',
        txs,
        this.execution.vm._common.hardfork(),
        'hits',
        hits,
        'misses',
        misses,
        'getNodeTime',
        getNodeTime,
        'runTime',
        Date.now() / 1000 - runTime,
        'total gas',
        gas
      )
    })

    console.log(this.execution.vm._common.hardfork())
    //console.log((<any>this.execution.vm.stateManager)._trie.db)

    const self = this
    this.execution.on('error', async (error: Error) => {
      self.emit('error', error)
      await self.stop()
    })

    this.chain.on('updated', async function () {
      // for some reason, if we use .on('updated', this.runBlocks)
      // it runs in the context of the Chain and not in the FullSync context..?
      if (self.running) {
        await self.execution.run()
      }
    })
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.chain.update()
  }

  /**
   * Returns synchronizer type
   * @return {string} type
   */
  get type(): string {
    return 'full'
  }

  /**
   * Returns true if peer can be used for syncing
   * @return {boolean}
   */
  syncable(peer: Peer): boolean {
    return peer.eth !== undefined
  }

  /**
   * Finds the best peer to sync with. We will synchronize to this peer's
   * blockchain. Returns null if no valid peer is found
   */
  best(): Peer | undefined {
    let best
    const peers = this.pool.peers.filter(this.syncable.bind(this))
    if (peers.length < this.config.minPeers && !this.forceSync) return
    for (const peer of peers) {
      if (peer.eth?.status) {
        const td = peer.eth.status.td
        if (
          (!best && td.gte(this.chain.blocks.td)) ||
          (best && best.eth && best.eth.status.td.lt(td))
        ) {
          best = peer
        }
      }
    }
    return best
  }

  /**
   * Get latest header of peer
   * @return {Promise} Resolves with header
   */
  async latest(peer: Peer) {
    const headers = await peer.eth?.getBlockHeaders({
      block: peer.eth!.status.bestHash,
      max: 1,
    })
    return headers?.[0]
  }

  /**
   * Sync all blocks and state from peer starting from current height.
   * @param  peer remote peer to sync with
   * @return Resolves when sync completed
   */
  async syncWithPeer(peer?: Peer): Promise<boolean> {
    if (!peer) return false
    this.syncPeer = peer
    const latest = await this.latest(peer)
    if (!latest) return false
    const height = new BN(latest.number)
    const first = latest.number.subn(PIVOT_BLOCKS)
    const count = height.sub(first).addn(1)
    if (count.lten(0)) return false

    const nextForkBlock = this.config.chainCommon.nextHardforkBlockBN()
    if (nextForkBlock) {
      if (first.gte(nextForkBlock)) {
        this.config.chainCommon.setHardforkByBlockNumber(first)
        this.hardfork = this.config.chainCommon.hardfork()
      }
    }

    this.config.logger.debug(
      `Syncing with peer: ${peer.toString(true)} height=${height.toString(10)}`
    )

    this.blockFetcher = new BlockFetcher({
      config: this.config,
      pool: this.pool,
      chain: this.chain,
      interval: this.interval,
      first,
      count: new BN(2),
    })

    this.blockFetcher.store = async (blocks: Block[]) => {
      // Preliminary checks
      if (blocks.length == 2) {
        if (blocks[0].header.number.eq(first) || blocks[1].header.number.eq(first)) {
          if (
            blocks[1].header.number.eq(first.addn(1)) ||
            blocks[0].header.number.eq(first.addn(1))
          ) {
            let root
            let block
            if (blocks[0].header.number.eq(first)) {
              root = blocks[0].header.stateRoot
              block = blocks[1]
            } else {
              root = blocks[1].header.stateRoot
              block = blocks[0]
            }
            console.log('previous state root', root.toString('hex'))
            console.log('hash', block.hash().toString('hex'))
            console.log('number', block.header.number.toString())
            console.log('txs', block.transactions.length)
            console.log('gas used', block.header.gasUsed.toString())

            /**
             * Get accounts/targets in parallel
             */

            const accounts = new Set()

            accounts.add(block.header.coinbase.buf.toString('hex'))

            block.transactions.forEach((tx: TypedTransaction) => {
              const sender = tx.getSenderAddress()

              accounts.add(sender.buf.toString('hex'))

              if (tx.to) {
                accounts.add(tx.to.buf.toString('hex'))
              } else {
                const to = generateAddress(sender.buf, toBuffer(tx.nonce))
                accounts.add(to.toString('hex'))
              }
            })

            /*
            accounts.forEach((addressString: any) => {
              const address = new Address(Buffer.from(addressString, 'hex'))
              // this will call into the database, if some nodes are not found then these will be requested from the peer
              // Tried this, nodes will disconnect because we are spamming them (have to batch these requests somehow)
              //this.execution.vm.stateManager.getAccount(address)
            }) */

            const time = Date.now() / 1000
            const result = await this.execution.vm.runBlock({
              block,
              root,
              skipBlockValidation: true, // this calls into blockchain; skip for now, otherwise we have to fetch the entire chain first
            })
            console.log('execution took', Date.now() / 1000 - time)
            console.log(
              'state root',
              (await this.execution.vm.stateManager.getStateRoot(true)).toString('hex')
            )
            console.log('gas used', result.gasUsed.toString())
            console.log('logsbloom', result.logsBloom.toString('hex'))
            console.log('receipt trie', result.receiptRoot.toString('hex'))
          }
        }
      }
    }

    this.blockFetcher
      .on('error', (error: Error) => {
        this.emit('error', error)
      })
      .on('fetched', (/*blocks: Block[]*/) => {})
    await this.blockFetcher.fetch()
    // TODO: Should this be deleted?
    // @ts-ignore: error: The operand of a 'delete' operator must be optional
    delete this.blockFetcher
    return true
  }

  /**
   * Fetch all blocks from current height up to highest found amongst peers
   * @return Resolves with true if sync successful
   */
  async sync(): Promise<boolean> {
    const peer = this.best()
    return this.syncWithPeer(peer)
  }

  /**
   * Chain was updated
   * @param  {Object[]} announcements new block hash announcements
   * @param  {Peer}     peer peer
   * @return {Promise}
   */
  async announced(announcements: any[], _peer: Peer) {
    if (announcements.length) {
      const [hash, height] = announcements[announcements.length - 1]
      this.config.logger.debug(`New height: number=${height.toString(10)} hash=${short(hash)}`)
      // TO DO: download new blocks
    }
  }

  /**
   * Open synchronizer. Must be called before sync() is called
   */
  async open(): Promise<void> {
    await this.chain.open()
    await this.execution.open()
    await this.pool.open()
    this.execution.syncing = true
    const number = this.chain.blocks.height.toNumber()
    const td = this.chain.blocks.td.toString(10)
    const hash = this.chain.blocks.latest!.hash()
    this.config.chainCommon.setHardforkByBlockNumber(number)
    this.hardfork = this.config.chainCommon.hardfork()
    this.config.logger.info(
      `Latest local block: number=${number} td=${td} hash=${short(hash)} hardfork=${this.hardfork}`
    )
  }

  /**
   * Stop synchronization. Returns a promise that resolves once its stopped.
   * @return {Promise}
   */
  async stop(): Promise<boolean> {
    this.execution.syncing = false
    await this.execution.stop()

    if (!this.running) {
      return false
    }

    if (this.blockFetcher) {
      this.blockFetcher.destroy()
      // TODO: Should this be deleted?
      // @ts-ignore: error: The operand of a 'delete' operator must be optional
      delete this.blockFetcher
    }
    await super.stop()

    return true
  }
}
