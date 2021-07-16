import { Readable, Writable } from 'stream'
const Heap = require('qheap')

import { PeerPool } from '../../net/peerpool'
import { Config } from '../../config'

import { Event, QHeap } from '../../types'
import { Job } from './types'
import { Peer } from '../../net/peer'

export interface FetcherOptions {
  /* Common chain config*/
  config: Config

  /* Peer pool */
  pool: PeerPool

  /* Fetch task timeout in ms (default: 8000) */
  timeout?: number

  /* How long to ban misbehaving peers in ms (default: 60000) */
  banTime?: number

  /* Max write queue size (default: 16) */
  maxQueue?: number

  /* Retry interval in ms (default: 1000) */
  interval?: number
}

/**
 * Base class for fetchers that retrieve various data from peers. Subclasses must
 * request(), process() and store() methods. Tasks can be arbitrary objects whose structure
 * is defined by subclasses. A priority queue is used to ensure tasks are fetched
 * inorder. Three types need to be provided: the JobTask, which describes a task the job should perform,
 * a JobResult, which is the direct result when a Peer replies to a Task, and a StorageItem, which
 * represents the to-be-stored items.
 * @memberof module:sync/fetcher
 */
export abstract class Fetcher<JobTask, JobResult, StorageItem> extends Readable {
  public config: Config

  protected pool: PeerPool
  protected timeout: number
  protected interval: number
  protected banTime: number
  protected maxQueue: number
  protected in: QHeap<Job<JobTask, JobResult, StorageItem>>
  protected out: QHeap<Job<JobTask, JobResult, StorageItem>>
  protected total: number
  protected processed: number // number of processed tasks, awaiting the write job
  protected finished: number // number of tasks which are both processed and also finished writing
  protected running: boolean
  protected reading: boolean
  private _readableState?: {
    // This property is inherited from Readable. We only need `length`.
    length: number
  }

  /**
   * Create new fetcher
   * @param {FetcherOptions}
   */
  constructor(options: FetcherOptions) {
    super({ ...options, objectMode: true })

    this.config = options.config
    this.pool = options.pool
    this.timeout = options.timeout ?? 8000
    this.interval = options.interval ?? 1000
    this.banTime = options.banTime ?? 60000
    this.maxQueue = options.maxQueue ?? 16

    this.in = new Heap({
      comparBefore: (
        a: Job<JobTask, JobResult, StorageItem>,
        b: Job<JobTask, JobResult, StorageItem>
      ) => a.index < b.index,
    })
    this.out = new Heap({
      comparBefore: (
        a: Job<JobTask, JobResult, StorageItem>,
        b: Job<JobTask, JobResult, StorageItem>
      ) => a.index < b.index,
    })
    this.total = 0
    this.processed = 0
    this.finished = 0
    this.running = false
    this.reading = false
  }

  /**
   * Request results from peer for the given job. Resolves with the raw result. If `undefined` is returned,
   * re-queue the job.
   * @param  job
   * @param  peer
   * @return {Promise}
   */
  abstract request(
    _job?: Job<JobTask, JobResult, StorageItem>,
    _peer?: Peer
  ): Promise<JobResult | undefined>

  /**
   * Process the reply for the given job. If the reply contains unexpected data, return `undefined`, this
   * re-queues the job.
   * @param  job fetch job
   * @param  result result data
   */
  abstract process(
    _job?: Job<JobTask, JobResult, StorageItem>,
    _result?: JobResult
  ): StorageItem[] | undefined

  /**
   * Store fetch result. Resolves once store operation is complete.
   * @param result fetch result
   * @return {Promise}
   */
  abstract store(_result: StorageItem[]): Promise<void>

  /**
   * Generate list of tasks to fetch
   * @return {Object[]} tasks
   */
  tasks(): JobTask[] {
    return []
  }

  /**
   * Enqueue job
   * @param job
   */
  enqueue(job: Job<JobTask, JobResult, StorageItem>) {
    if (this.running) {
      this.in.insert({
        ...job,
        time: Date.now(),
        state: 'idle',
      })
    }
  }

  /**
   * Dequeue all done tasks that completed in order
   */
  dequeue() {
    for (let f = this.out.peek(); f && f.index === this.processed; ) {
      this.processed++
      const { result } = this.out.remove()!
      if (!this.push(result)) {
        return
      }
      f = this.out.peek()
    }
  }

  /**
   * Implements Readable._read() by pushing completed tasks to the read queue
   */
  _read() {
    this.dequeue()
  }

  /**
   * handle successful job completion
   * @private
   * @param  job successful job
   * @param  result job result
   */
  success(job: Job<JobTask, JobResult, StorageItem>, result?: JobResult) {
    if (job.state !== 'active') return
    if (result === undefined) {
      this.enqueue(job)
      // TODO: should this promise actually float?
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.wait().then(() => {
        job.peer!.idle = true
      })
    } else {
      job.peer!.idle = true
      job.result = this.process(job, result)
      if (job.result) {
        this.out.insert(job)
        this.dequeue()
      } else {
        this.enqueue(job)
      }
    }
    this.next()
  }

  /**
   * handle failed job completion
   * @private
   * @param  job failed job
   * @param  [error] error
   */
  failure(job: Job<JobTask, JobResult, StorageItem>, error?: Error) {
    if (job.state !== 'active') return
    job.peer!.idle = true
    this.pool.ban(job.peer!, this.banTime)
    this.enqueue(job)
    if (error) {
      this.error(error, job)
    }
    this.next()
  }

  /**
   * Process next task
   */
  next() {
    const job = this.in.peek()
    if (
      !job ||
      this._readableState!.length > this.maxQueue ||
      job.index > this.processed + this.maxQueue ||
      this.processed === this.total
    ) {
      return false
    }
    const peer = this.peer()
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (peer) {
      peer.idle = false
      this.in.remove()
      job.peer = peer
      job.state = 'active'
      const timeout = setTimeout(() => {
        this.expire(job)
      }, this.timeout)
      this.request(job, peer)
        .then((result?: JobResult) => this.success(job, result))
        .catch((error: Error) => this.failure(job, error))
        .finally(() => clearTimeout(timeout))
      return job
    }
  }

  /**
   * Handle error
   * @param  {Error}  error error object
   * @param  {Object} job  task
   */
  error(error: Error, job?: Job<JobTask, JobResult, StorageItem>) {
    if (this.running) {
      this.config.events.emit(Event.SYNC_FETCHER_ERROR, error, job && job.task, job && job.peer)
    }
  }

  /**
   * Setup writer pipe and start writing fetch results. A pipe is used in order
   * to support backpressure from storing results.
   */
  write() {
    const _write = async (result: StorageItem[], encoding: string | null, cb: Function) => {
      try {
        await this.store(result)
        this.finished++
        this.config.events.emit(Event.SYNC_FETCHER_FETCHED, result as any)
        cb()
      } catch (error) {
        cb(error)
      }
    }
    const writer = new Writable({
      objectMode: true,
      write: _write,
      writev: (many: { chunk: StorageItem; encoding: string }[], cb: Function) =>
        _write(
          (<StorageItem[]>[]).concat(
            ...many.map((x: { chunk: StorageItem; encoding: string }) => x.chunk)
          ),
          null,
          cb
        ),
    })
    this.on('close', () => {
      this.running = false
      writer.destroy()
    })
      .pipe(writer)
      .on('finish', () => {
        this.running = false
      })
      .on('error', (error: Error) => {
        this.error(error)
        this.running = false
        writer.destroy()
      })
  }

  /**
   * Run the fetcher. Returns a promise that resolves once all tasks are completed.
   * @return {Promise}
   */
  async fetch() {
    if (this.running) {
      return false
    }
    this.write()
    this.tasks().forEach((task: JobTask) => {
      const job: Job<JobTask, JobResult, StorageItem> = {
        task,
        time: Date.now(),
        index: this.total++,
        state: 'idle',
        peer: null,
      }
      this.in.insert(job)
    })
    this.running = true
    while (this.running) {
      if (!this.next()) {
        if (this.finished === this.total) {
          this.push(null)
        }
        await this.wait()
      }
    }
    this.destroy()
  }

  /**
   * Returns a peer that can process the given job
   * @param  job job
   * @return {Peer}
   */
  // TODO: what is job supposed to be?
  peer(_job?: Job<JobTask, JobResult, StorageItem>) {
    return this.pool.idle()
  }

  /**
   * Expire job that has timed out and ban associated peer. Timed out tasks will
   * be re-inserted into the queue.
   */
  expire(job: Job<JobTask, JobResult, StorageItem>) {
    job.state = 'expired'
    if (this.pool.contains(job.peer!)) {
      this.config.logger.debug(
        `Task timed out for peer (banning) ${JSON.stringify(job.task)} ${job.peer}`
      )
      this.pool.ban(job.peer!, this.banTime)
    } else {
      this.config.logger.debug(
        `Peer disconnected while performing task ${JSON.stringify(job.task)} ${job.peer}`
      )
    }
    this.enqueue(job)
  }

  async wait(delay?: number) {
    await new Promise((resolve) => setTimeout(resolve, delay ?? this.interval))
  }
}
