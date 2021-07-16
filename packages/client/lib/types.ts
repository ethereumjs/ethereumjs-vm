import { EventEmitter } from 'events'
import type multiaddr from 'multiaddr'
import type { Block, BlockHeader } from '@ethereumjs/block'
import type Connection from '../../../node_modules/libp2p-interfaces/dist/src/connection/connection'
import type { MuxedStream } from '../../../node_modules/libp2p-interfaces/dist/src/stream-muxer/types'
import { Peer } from './net/peer'
import { BN } from '../../util/dist'
import { Server } from './net/server'
/**
 * Types for the central event bus, emitted
 * by different components of the client.
 */
export enum Event {
  CHAIN_UPDATED = 'blockchain:chain:updated',
  SYNC_EXECUTION_VM_ERROR = 'sync:execution:vm:error',
  SYNC_FETCHER_FETCHED = 'sync:fetcher:fetched',
  SYNC_SYNCHRONIZED = 'sync:synchronized',
  SYNC_ERROR = 'sync:error',
  SYNC_FETCHER_ERROR = 'sync:fetcher:error',
  PEER_CONNECTED = 'peer:connected',
  PEER_DISCONNECTED = 'peer:disconnected',
  PEER_ERROR = 'peer:error',
  SERVER_LISTENING = 'server:listening',
  SERVER_ERROR = 'server:error',
  POOL_PEER_ADDED = 'pool:peer:added',
  POOL_PEER_REMOVED = 'pool:peer:removed',
  POOL_PEER_BANNED = 'pool:peer:banned',
  PROTOCOL_ERROR = 'protocol:error',
  PROTOCOL_MESSAGE = 'protocol:message',
}
export interface EventParams {
  [Event.CHAIN_UPDATED]: []
  [Event.SYNC_EXECUTION_VM_ERROR]: [Error] // [vmError]
  [Event.SYNC_FETCHER_FETCHED]: [Block[] | BlockHeader[]] // [blocksOrHeadersFetched]
  [Event.SYNC_SYNCHRONIZED]: [BN] // [headBlockNum]
  [Event.SYNC_ERROR]: [Error] // [syncError]
  [Event.SYNC_FETCHER_ERROR]: [Error, any, any] // [fetchError, task, peer]
  [Event.PEER_CONNECTED]: [Peer] // [connectedPeer]
  [Event.PEER_DISCONNECTED]: [Peer] // [disconnectedPeer]
  [Event.PEER_ERROR]: [Error, Peer] // [error, peerCausingError]
  [Event.SERVER_LISTENING]: [any] // [{ transport : string, url: string} ] - Typescript 3.X doesn't allow named tuples
  [Event.SERVER_ERROR]: [Error, Server] // [serverError, serverCausingError]
  [Event.POOL_PEER_ADDED]: [Peer] // [addedPeer]
  [Event.POOL_PEER_REMOVED]: [Peer] // [removedPeer]
  [Event.POOL_PEER_BANNED]: [Peer] // [bannedPeer]
  [Event.PROTOCOL_ERROR]: [Error, Peer] // [boundProtocolError, peerCausingError]
  [Event.PROTOCOL_MESSAGE]: [any, string, Peer] // [ messageDetails, protocolName, peerSendingMessage]
}

export declare interface EventBus<T extends Event> {
  emit(event: T, ...args: EventParams[T]): boolean
  on(event: T, listener: (...args: EventParams[T]) => void): this
}

/* eslint-disable @typescript-eslint/no-unused-vars */
// eslint-disable-next-line no-redeclare
export class EventBus<T extends Event> extends EventEmitter {}
export type EventBusType = EventBus<Event.CHAIN_UPDATED> &
  EventBus<Event.SYNC_EXECUTION_VM_ERROR> &
  EventBus<Event.SYNC_FETCHER_FETCHED> &
  EventBus<Event.SYNC_SYNCHRONIZED> &
  EventBus<Event.SYNC_FETCHER_ERROR> &
  EventBus<Event.PEER_CONNECTED> &
  EventBus<Event.PEER_DISCONNECTED> &
  EventBus<Event.PEER_ERROR> &
  EventBus<Event.SERVER_LISTENING> &
  EventBus<Event.SERVER_ERROR> &
  EventBus<Event.SYNC_ERROR> &
  EventBus<Event.POOL_PEER_ADDED> &
  EventBus<Event.POOL_PEER_REMOVED> &
  EventBus<Event.POOL_PEER_BANNED> &
  EventBus<Event.PROTOCOL_ERROR> &
  EventBus<Event.PROTOCOL_MESSAGE>
/* eslint-enable @typescript-eslint/no-unused-vars */

/**
 * Like types
 */
export type Key = Buffer
export type KeyLike = string | Key

export type MultiaddrLike = string | string[] | multiaddr | multiaddr[]

/**
 * DNS
 */
export type DnsNetwork = string

/**
 * Libp2p aliases for convenience
 */
export type Libp2pConnection = Connection
export type Libp2pMuxedStream = MuxedStream

/**
 * QHeap types.
 * @types/qheap does not exist, so we define a custom interface here.
 */
type QHeapOptions = {
  comparBefore(a: any, b: any): boolean
  compar(a: any, b: any): number
  freeSpace: number
  size: number
}
export interface QHeap<T> {
  // eslint-disable-next-line @typescript-eslint/no-misused-new
  new (opts: QHeapOptions): QHeap<T>
  insert(item: T): void
  push(item: T): void
  enqueue(item: T): void
  remove(): T | undefined
  shift(): T | undefined
  dequeue(): T | undefined
  peek(): T | undefined
  length: number
  gc(opts: { minLength: number; maxLength: number }): void
}
