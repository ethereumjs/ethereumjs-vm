# @ethereumjs/devp2p

[![NPM Status][devp2p-npm-badge]][devp2p-npm-link]
[![GitHub Issues][devp2p-issues-badge]][devp2p-issues-link]
[![Actions Status][devp2p-actions-badge]][devp2p-actions-link]
[![Coverage Status][devp2p-coverage-badge]][devp2p-coverage-link]
[![Discord][discord-badge]][discord-link]

This library bundles different components for lower-level peer-to-peer connection and message exchange:

- Distributed Peer Table (DPT) / v4 Node Discovery / DNS Discovery
- RLPx Transport Protocol
- Ethereum Wire Protocol (ETH/65)
- Light Ethereum Subprotocol (LES/2)

The library is based on [ethereumjs/node-devp2p](https://github.com/ethereumjs/node-devp2p) as well
as other sub-libraries (`node-*` named) (all outdated).

## Run/Build

To build the `dist/` directory, run:

```
npm run build
```

You can also use `ts-node` to run a script without first transpiling to js (you need to `npm i --save-dev ts-node` first):

```
node -r ts-node/register [YOUR_SCRIPT_TO_RUN.ts]
```

## Usage/Examples

All components of this library are implemented as Node `EventEmitter` objects
and make heavy use of the Node.js network stack.

You can react on events from the network like this:

```
dpt.on('peer:added', (peer) => {
  // Do something...
})
```

Basic example to connect to some bootstrap nodes and get basic peer info:

- [simple](examples/simple.ts)

Communicate with peers to read new transaction and block information:

- [peer-communication](examples/peer-communication.ts)

Run an example with:

```
DEBUG=devp2p:* node -r ts-node/register ./examples/peer-communication.ts
```

## Docs

For a complete API reference see the generated [documentation](./docs).

Additionally you can find a description of the main entrypoints for using
the different modules in the following sections.

## Distributed Peer Table (DPT) / Node Discovery

Maintain/manage a list of peers, see [./src/dpt/](./src/dpt/), also
includes node discovery ([./src/dpt/server.ts](./src/dpt/server.ts))

### Usage

Create your peer table:

```
const dpt = new DPT(Buffer.from(PRIVATE_KEY, 'hex'), {
  endpoint: {
    address: '0.0.0.0',
    udpPort: null,
    tcpPort: null
  }
})
```

Add some bootstrap nodes (or some custom nodes with `dpt.addPeer()`):

```
dpt.bootstrap(bootnode).catch((err) => console.error('Something went wrong!'))
```

### API

See the following [diagram](./diagram/devp2p.svg) for a high level overview on the library.

#### `DPT` (extends `EventEmitter`)

Distributed Peer Table. Manages a Kademlia DHT K-bucket (`Kbucket`) for storing peer information
and a `BanList` for keeping a list of bad peers. `Server` implements the node discovery (`ping`,
`pong`, `findNeighbours`).

##### `new DPT(privateKey, options)`

Creates new DPT object

- `privateKey` - Key for message encoding/signing.
- `options.timeout` - Timeout in ms for server `ping`, passed to `Server` (default: `10s`).
- `options.endpoint` - Endpoint information to send with the server `ping`, passed to `Server` (default: `{ address: '0.0.0.0', udpPort: null, tcpPort: null }`).
- `options.createSocket` - A datagram (dgram) `createSocket` function, passed to `Server` (default: `dgram.createSocket.bind(null, 'udp4')`).
- `options.refreshInterval` - Interval in ms for refreshing (calling `findNeighbours`) the peer list (default: `60s`).
- `options.shouldFindNeighbours` - Toggles whether or not peers should be queried with 'findNeighbours' to discover more peers (default: `true`)
- `options.shouldGetDnsPeers` - Toggles whether or not peers should be discovered by querying EIP-1459 DNS lists (default: `false`)
- `options.dnsRefreshQuantity` - Max number of candidate peers to retrieve from DNS records when attempting to discover new nodes (default: `25`)
- `options.dnsNetworks` - EIP-1459 ENR tree urls to query for peer discovery (default: network dependent)
- `options.dnsAddr` - DNS server to query DNS TXT records from for peer discovery

#### `dpt.bootstrap(peer)` (`async`)

Uses a peer as new bootstrap peer and calls `findNeighbouts`.

- `peer` - Peer to be added, format `{ address: [ADDRESS], udpPort: [UDPPORT], tcpPort: [TCPPORT] }`.

#### `dpt.addPeer(object)` (`async`)

Adds a new peer.

- `object` - Peer to be added, format `{ address: [ADDRESS], udpPort: [UDPPORT], tcpPort: [TCPPORT] }`.

For other utility functions like `getPeer`, `getPeers` see [./src/dpt/dpt.ts](./src/dpt/dpt.ts).

### Events

Events emitted:

| Event        |         Description          |
| ------------ | :--------------------------: |
| peer:added   |   Peer added to DHT bucket   |
| peer:removed | Peer removed from DHT bucket |
| peer:new     |        New peer added        |
| listening    |    Forwarded from server     |
| close        |    Forwarded from server     |
| error        |    Forwarded from server     |

### Reference

- [Node discovery protocol](https://github.com/ethereum/wiki/wiki/Node-discovery-protocol)
- [RLPx - Node Discovery Protocol](https://github.com/ethereum/devp2p/blob/master/rlpx.md#node-discovery)
- [Kademlia Peer Selection](https://github.com/ethereum/wiki/wiki/Kademlia-Peer-Selection)

## RLPx Transport Protocol

Connect to a peer, organize the communication, see [./src/rlpx/](./src/rlpx/)

### Usage

Instantiate an [@ethereumjs/common](https://github.com/ethereumjs/ethereumjs-monorepo/tree/master/packages/common)
instance with the network you want to connect to:

```typescript
const common = new Common({ chain: 'mainnet' })
```

Create your `RLPx` object, e.g.:

```typescript
const rlpx = new devp2p.RLPx(PRIVATE_KEY, {
  dpt,
  maxPeers: 25,
  capabilities: [devp2p.ETH.eth65, devp2p.ETH.eth64],
  common,
})
```

### API

#### `RLPx` (extends `EventEmitter`)

Manages the handshake (`ECIES`) and the handling of the peer communication (`Peer`).

##### `new RLPx(privateKey, options)`

Creates new RLPx object

- `privateKey` - Key for message encoding/signing.
- `options.timeout` - Peer `ping` timeout in ms (default: `10s`).
- `options.maxPeers` - Max number of peer connections (default: `10`).
- `options.clientId` - Client ID string (default example: `ethereumjs-devp2p/v2.1.3/darwin-x64/nodejs`).
- `options.remoteClientIdFilter` - Optional list of client ID filter strings (e.g. `['go1.5', 'quorum']`).
- `options.capabilities` - Upper layer protocol capabilities, e.g. `[devp2p.ETH.eth63, devp2p.ETH.eth62]`.
- `options.listenPort` - The listening port for the server or `null` for default.
- `options.dpt` - `DPT` object for the peers to connect to (default: `null`, no `DPT` peer management).
- `options.common` - An instance of [`@ethereumjs/common`](https://github.com/ethereumjs/ethereumjs-monorepo/tree/master/packages/common).

#### `rlpx.connect(peer)` (`async`)

Manually connect to peer without `DPT`.

- `peer` - Peer to connect to, format `{ id: PEER_ID, address: PEER_ADDRESS, port: PEER_PORT }`.

For other connection/utility functions like `listen`, `getPeers` see [./src/rlpx/rlpx.ts](./src/rlpx/rlpx.ts).

### Events

Events emitted:

| Event        |          Description           |
| ------------ | :----------------------------: |
| peer:added   | Handshake with peer successful |
| peer:removed |     Disconnected from peer     |
| peer:error   |    Error connecting to peer    |
| listening    |     Forwarded from server      |
| close        |     Forwarded from server      |
| error        |     Forwarded from server      |

### Reference

- [RLPx: Cryptographic Network & Transport Protocol](https://github.com/ethereum/devp2p/blob/master/rlpx.md)
- [devp2p wire protocol](https://github.com/ethereum/wiki/wiki/%C3%90%CE%9EVp2p-Wire-Protocol)

## Ethereum Wire Protocol (ETH)

Upper layer protocol for exchanging Ethereum network data like block headers or transactions with a node, see [./src/eth/](./src/eth/).

### Usage

Send the initial status message with `sendStatus()`, then wait for the corresponding `status` message
to arrive to start the communication.

```
eth.once('status', () => {
  // Send an initial message
  eth.sendMessage()
})
```

Wait for follow-up messages to arrive, send your responses.

```
eth.on('message', async (code, payload) => {
  if (code === devp2p.ETH.MESSAGE_CODES.NEW_BLOCK_HASHES) {
    // Do something with your new block hashes :-)
  }
})
```

See the `peer-communication.ts` example for a more detailed use case.

### API

#### `ETH` (extends `EventEmitter`)

Handles the different message types like `NEW_BLOCK_HASHES` or `GET_NODE_DATA` (see `MESSAGE_CODES`) for
a complete list.

##### `new ETH(privateKey, options)`

Normally not instantiated directly but created as a `SubProtocol` in the `Peer` object.

- `version` - The protocol version for communicating, e.g. `65`.
- `peer` - `Peer` object to communicate with.
- `send` - Wrapped `peer.sendMessage()` function where the communication is routed to.

#### `eth.sendStatus(status)`

Send initial status message.

- `status` - Status message to send, format `{td: TOTAL_DIFFICULTY_BUFFER, bestHash: BEST_HASH_BUFFER, genesisHash: GENESIS_HASH_BUFFER }`, `networkId` (respectively `chainId`) is taken from the `Common` instance

#### `eth.sendMessage(code, payload)`

Send initial status message.

- `code` - The message code, see `MESSAGE_CODES` for available message types.
- `payload` - Payload as a list, will be rlp-encoded.

### Events

Events emitted:

| Event   |     Description      |
| ------- | :------------------: |
| message |   Message received   |
| status  | Status info received |

### Reference

- [Ethereum wire protocol](https://github.com/ethereum/wiki/wiki/Ethereum-Wire-Protocol)

## Light Ethereum Subprotocol (LES)

Upper layer protocol used by light clients, see [./src/les/](./src/les/).

### Usage

Send the initial status message with `sendStatus()`, then wait for the corresponding `status` message
to arrive to start the communication.

```
les.once('status', () => {
  // Send an initial message
  les.sendMessage()
})
```

Wait for follow-up messages to arrive, send your responses.

```
les.on('message', async (code, payload) => {
  if (code === devp2p.LES.MESSAGE_CODES.BLOCK_HEADERS) {
    // Do something with your new block headers :-)
  }
})
```

See the `peer-communication-les.ts` example for a more detailed use case.

### API

#### `LES` (extends `EventEmitter`)

Handles the different message types like `BLOCK_HEADERS` or `GET_PROOFS_V2` (see `MESSAGE_CODES`) for
a complete list. Currently protocol version `LES/2` running in client-mode is supported.

##### `new LES(privateKey, options)`

Normally not instantiated directly but created as a `SubProtocol` in the `Peer` object.

- `version` - The protocol version for communicating, e.g. `2`.
- `peer` - `Peer` object to communicate with.
- `send` - Wrapped `peer.sendMessage()` function where the communication is routed to.

#### `les.sendStatus(status)`

Send initial status message.

- `status` - Status message to send, format `{ headTd: TOTAL_DIFFICULTY_BUFFER, headHash: HEAD_HASH_BUFFER, headNum: HEAD_NUM_BUFFER, genesisHash: GENESIS_HASH_BUFFER }`, `networkId` (respectively `chainId`) is taken from the `Common` instance

#### `les.sendMessage(code, reqId, payload)`

Send initial status message.

- `code` - The message code, see `MESSAGE_CODES` for available message types.
- `reqId` - Request ID, will be echoed back on response.
- `payload` - Payload as a list, will be rlp-encoded.

### Events

Events emitted:

| Event   |     Description      |
| ------- | :------------------: |
| message |   Message received   |
| status  | Status info received |

### Reference

- [Light client protocol](https://github.com/ethereum/wiki/wiki/Light-client-protocol)

## Browser

While it's possible to bundle this package for the browser, some features do not work:
+ EIP-1459 (DNS Peer Discovery) is disabled due to the absence of a standard polyfill for Node's `dns`
module. DNS discovery mode can be toggled on/off via the DPTOption `shouldGetDnsPeers` ("false"
by default).

## Tests

There are unit tests in the `test/` directory which can be run with:

```
npm run test
```

## Debugging

This library uses [debug](https://github.com/visionmedia/debug) debugging utility package.

For the debugging output to show up, set the `DEBUG` environment variable (e.g. in Linux/Mac OS:
`export DEBUG=*,-babel`).

Use the `DEBUG` environment variable to active the logger output you are interested in, e.g.:

DEBUG=devp2p:dpt:\*,devp2p:eth node -r ts-node/register [YOUR_SCRIPT_TO_RUN.ts]

For more verbose output on logging (e.g. to output the entire msg payload) use the `verbose` logger
in addition:

DEBUG=devp2p:dpt:\*,devp2p:eth,verbose node -r ts-node/register [YOUR_SCRIPT_TO_RUN.ts]

Exemplary logging output:

```
Add peer: 52.3.158.184:30303 Geth/v1.7.3-unstable-479aa61f/linux-amd64/go1.9 (eth63) (total: 2)
  devp2p:rlpx:peer Received body 52.169.42.101:30303 01c110 +133ms
  devp2p:rlpx:peer Message code: 1 - 0 = 1 +0ms
  devp2p:rlpx refill connections.. queue size: 0, open slots: 20 +1ms
  devp2p:rlpx 52.169.42.101:30303 disconnect, reason: 16 +1ms
Remove peer: 52.169.42.101:30303 (peer disconnect, reason code: 16) (total: 1)
```

## Developer

### Diagram Updates

To update the structure diagram files in the root folder open the `devp2p.drawio` file in [draw.io](https://draw.io/), make your changes, and open a PR with the updated files. Export `svg` and `png` with `border` `width=20` and `transparency=false`. For `png` go to "Advanced" and select `300 DPI`.

## General References

### Other Implementations

The following is a list of major implementations of the `devp2p` stack in other languages:

- Python: [pydevp2p](https://github.com/ethereum/pydevp2p)
- Go: [Go Ethereum](https://github.com/ethereum/go-ethereum/tree/master/p2p)
- Elixir: [Exthereum](https://github.com/exthereum/exth_crypto)

### Links

- [Blog article series](https://ocalog.com/post/10/) on implementing Ethereum protocol stack

## License

MIT

[discord-badge]: https://img.shields.io/static/v1?logo=discord&label=discord&message=Join&color=blue
[discord-link]: https://discord.gg/TNwARpR
[devp2p-npm-badge]: https://img.shields.io/npm/v/ethereumjs-devp2p.svg
[devp2p-npm-link]: https://www.npmjs.org/package/ethereumjs-devp2p
[devp2p-issues-badge]: https://img.shields.io/github/issues/ethereumjs/ethereumjs-monorepo/package:%20devp2p?label=issues
[devp2p-issues-link]: https://github.com/ethereumjs/ethereumjs-monorepo/issues?q=is%3Aopen+is%3Aissue+label%3A"package%3A+devp2p"
[devp2p-actions-badge]: https://github.com/ethereumjs/ethereumjs-monorepo/workflows/Devp2p/badge.svg
[devp2p-actions-link]: https://github.com/ethereumjs/ethereumjs-monorepo/actions?query=workflow%3A%22Devp2p%22
[devp2p-coverage-badge]: https://codecov.io/gh/ethereumjs/ethereumjs-monorepo/branch/master/graph/badge.svg?flag=devp2p
[devp2p-coverage-link]: https://codecov.io/gh/ethereumjs/ethereumjs-monorepo/tree/master/packages/devp2p
