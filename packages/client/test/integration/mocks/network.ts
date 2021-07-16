import { EventEmitter } from 'events'
const DuplexPair = require('it-pair/duplex')

const Stream = function (protocols: string[]) {
  const [local, remote] = DuplexPair()
  return {
    local: (remoteId: string) => ({ ...local, remoteId, protocols }),
    remote: (location: string) => ({ ...remote, location, protocols }),
  }
}

// eslint-disable-next-line no-redeclare
export type Stream = ReturnType<typeof Stream>
export type RemoteStream = ReturnType<Stream['remote']>

interface ServerDetails {
  [key: string]: {
    server: EventEmitter
    streams: {
      [key: string]: Stream
    }
  }
}
export const servers: ServerDetails = {}

/* eslint-disable @typescript-eslint/no-unnecessary-condition */

export function createServer(location: string) {
  if (servers[location]) {
    throw new Error(`Already running a server at ${location}`)
  }
  servers[location] = {
    server: new EventEmitter(),
    streams: {},
  }
  // TODO: Convert to proper server listening event if needed
  setTimeout(() => servers[location].server.emit('listening'), 10)
  return servers[location].server
}

export function destroyStream(id: string, location: string) {
  if (servers[location]) {
    const stream = servers[location].streams[id]
    if (stream) {
      delete servers[location].streams[id]
    }
  }
}

export function destroyServer(location: string) {
  if (servers[location]) {
    for (const id of Object.keys(servers[location].streams)) {
      destroyStream(id, location)
    }
  }
  delete servers[location]
}

export function createStream(id: string, location: string, protocols: string[]) {
  if (!servers[location]) {
    throw new Error(`There is no server at ${location}`)
  }
  const stream = Stream(protocols)
  servers[location].streams[id] = stream
  setTimeout(
    () => servers[location].server.emit('connection', { id, stream: stream.local(id) }),
    10
  )
  return stream.remote(location)
}
