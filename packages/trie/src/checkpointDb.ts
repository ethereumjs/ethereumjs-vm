import { LevelUp } from 'levelup'
import { DB, BatchDBOp } from './db'

export const ENCODING_OPTS = { keyEncoding: 'binary', valueEncoding: 'binary' }

export type Checkpoint = {
  // We cannot use a Buffer => Buffer map directly. If you create two Buffers with the same internal value,
  // then when setting a value on the Map, it actually creates two indices.
  keyValueMap: Map<string, Buffer | null>
  root: Buffer
}

/**
 * DB is a thin wrapper around the underlying levelup db,
 * which validates inputs and sets encoding type.
 */
export class CheckpointDB extends DB {
  public checkpoints: Checkpoint[]

  /**
   * Initialize a DB instance. If `leveldb` is not provided, DB
   * defaults to an [in-memory store](https://github.com/Level/memdown).
   * @param leveldb - An abstract-leveldown compliant store
   */
  constructor(leveldb?: LevelUp) {
    super(leveldb)
    // Roots of trie at the moment of checkpoint
    this.checkpoints = []
  }

  /**
   * Is the DB during a checkpoint phase?
   */
  get isCheckpoint() {
    return this.checkpoints.length > 0
  }

  /**
   * Adds a new checkpoint to the stack
   * @param root
   */
  checkpoint(root: Buffer) {
    this.checkpoints.push({ keyValueMap: new Map<string, Buffer>(), root })
  }

  /**
   * Commits the latest checkpoint
   */
  async commit() {
    const { keyValueMap } = this.checkpoints.pop()!
    if (!this.isCheckpoint) {
      // This was the final checkpoint, we should now commit and flush everything to disk
      const batchOp: BatchDBOp[] = []
      keyValueMap.forEach(function (value, key) {
        if (value === null) {
          batchOp.push({
            type: 'del',
            key: Buffer.from(key, 'hex'),
          })
        } else {
          batchOp.push({
            type: 'put',
            key: Buffer.from(key, 'hex'),
            value,
          })
        }
      })
      await this.batch(batchOp)
    } else {
      // dump everything into the current (higher level) cache
      const currentKeyValueMap = this.checkpoints[this.checkpoints.length - 1].keyValueMap
      keyValueMap.forEach(function (value, key) {
        currentKeyValueMap.set(key, value)
      })
    }
  }

  /**
   * Reverts the latest checkpoint
   */
  async revert() {
    const { root } = this.checkpoints.pop()!
    return root
  }

  /**
   * Retrieves a raw value from leveldb.
   * @param key
   * @returns A Promise that resolves to `Buffer` if a value is found or `null` if no value is found.
   */
  async get(key: Buffer): Promise<Buffer | null> {
    // Lookup the value in our cache. We return the latest checkpointed value (which should be the value on disk)
    for (let index = this.checkpoints.length - 1; index >= 0; index--) {
      const value = this.checkpoints[index].keyValueMap.get(key.toString('hex'))
      if (value !== undefined) {
        return value
      }
    }
    // Nothing has been found in cache, look up from disk
    // TODO: put value in cache if we are a checkpoint.
    return await super.get(key)
  }

  /**
   * Writes a value directly to leveldb.
   * @param key The key as a `Buffer`
   * @param value The value to be stored
   */
  async put(key: Buffer, val: Buffer): Promise<void> {
    if (this.isCheckpoint) {
      // put value in cache
      this.checkpoints[this.checkpoints.length - 1].keyValueMap.set(key.toString('hex'), val)
    } else {
      await super.put(key, val)
    }
  }

  /**
   * Removes a raw value in the underlying leveldb.
   * @param keys
   */
  async del(key: Buffer): Promise<void> {
    if (this.isCheckpoint) {
      // delete the value in the current cache
      this.checkpoints[this.checkpoints.length - 1].keyValueMap.set(key.toString('hex'), null)
    } else {
      // delete the value on disk
      await this._leveldb.del(key, ENCODING_OPTS)
    }
  }

  /**
   * Performs a batch operation on db.
   * @param opStack A stack of levelup operations
   */
  async batch(opStack: BatchDBOp[]): Promise<void> {
    if (this.isCheckpoint) {
      for (const op of opStack) {
        if (op.type === 'put') {
          await this.put(op.key, op.value)
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        } else if (op.type === 'del') {
          await this.del(op.key)
        }
      }
    } else {
      await super.batch(opStack)
    }
  }
}