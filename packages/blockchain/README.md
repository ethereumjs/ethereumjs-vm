# @ethereumjs/blockchain

[![NPM Package][blockchain-npm-badge]][blockchain-npm-link]
[![GitHub Issues][blockchain-issues-badge]][blockchain-issues-link]
[![Actions Status][blockchain-actions-badge]][blockchain-actions-link]
[![Code Coverage][blockchain-coverage-badge]][blockchain-coverage-link]
[![Discord][discord-badge]][discord-link]

| A module to store and interact with blocks. |
| --- |

Note: this `README` reflects the state of the library from `v5.0.0` onwards. See `README` from the [standalone repository](https://github.com/ethereumjs/ethereumjs-blockchain) for an introduction on the last preceeding release.

# INSTALL

`npm install @ethereumjs/blockchain`

# USAGE

## Introduction

The following is an example to iterate through an existing Geth DB (needs `level` to be installed separately).

This module performs write operations. Making a backup of your data before trying it is recommended. Otherwise, you can end up with a compromised DB state.

```typescript
import Blockchain from '@ethereumjs/blockchain'

const level = require('level')

const gethDbPath = './chaindata' // Add your own path here. It will get modified, see remarks.

const common = new Common({ chain: 'ropsten' })
const db = level(gethDbPath)
// Use the safe static constructor which awaits the init method
const blockchain = Blockchain.create({ common, db })

blockchain.iterator('i', (block) => {
  const blockNumber = block.header.number.toString()
  const blockHash = block.hash().toString('hex')
  console.log(`Block ${blockNumber}: ${blockHash}`)
})
```

**WARNING**: Since `@ethereumjs/blockchain` is also doing write operations on the DB for safety reasons only run this on a copy of your database, otherwise this might lead to a compromised DB state.

## EIP-1559 Support

This library supports the handling of `EIP-1559` blocks and transactions starting with the `v5.3.0` release.

# API

[Documentation](./docs/README.md)

# DEVELOPER

For debugging blockchain control flows the [debug](https://github.com/visionmedia/debug) library is used and can be activated on the CL with `DEBUG=[Logger Selection] node [Your Script to Run].js`.

The following initial logger is currently available:

| Logger | Description |
| - | - |
| `blockchain:clique` | Clique operations like updating the vote and/or signer list  |

The following is an example for a logger run:

Run with the clique logger:

```shell
DEBUG=blockchain:clique ts-node test.ts
```

# EthereumJS

See our organizational [documentation](https://ethereumjs.readthedocs.io) for an introduction to `EthereumJS` as well as information on current standards and best practices.

If you want to join for work or do improvements on the libraries have a look at our [contribution guidelines](https://ethereumjs.readthedocs.io/en/latest/contributing.html).

[discord-badge]: https://img.shields.io/static/v1?logo=discord&label=discord&message=Join&color=blue
[discord-link]: https://discord.gg/TNwARpR
[blockchain-npm-badge]: https://img.shields.io/npm/v/@ethereumjs/blockchain.svg
[blockchain-npm-link]: https://www.npmjs.com/package/@ethereumjs/blockchain
[blockchain-issues-badge]: https://img.shields.io/github/issues/ethereumjs/ethereumjs-monorepo/package:%20blockchain?label=issues
[blockchain-issues-link]: https://github.com/ethereumjs/ethereumjs-monorepo/issues?q=is%3Aopen+is%3Aissue+label%3A"package%3A+blockchain"
[blockchain-actions-badge]: https://github.com/ethereumjs/ethereumjs-monorepo/workflows/Blockchain/badge.svg
[blockchain-actions-link]: https://github.com/ethereumjs/ethereumjs-monorepo/actions?query=workflow%3A%22Blockchain%22
[blockchain-coverage-badge]: https://codecov.io/gh/ethereumjs/ethereumjs-monorepo/branch/master/graph/badge.svg?flag=blockchain
[blockchain-coverage-link]: https://codecov.io/gh/ethereumjs/ethereumjs-monorepo/tree/master/packages/blockchain
