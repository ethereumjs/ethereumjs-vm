# @ethereumjs/block

[![NPM Package][block-npm-badge]][block-npm-link]
[![GitHub Issues][block-issues-badge]][block-issues-link]
[![Actions Status][block-actions-badge]][block-actions-link]
[![Code Coverage][block-coverage-badge]][block-coverage-link]
[![Discord][discord-badge]][discord-link]

| Implements schema and functions related to Ethereum's block. |
| --- |

Note: this `README` reflects the state of the library from `v3.0.0` onwards. See `README` from the [standalone repository](https://github.com/ethereumjs/ethereumjs-block) for an introduction on the last preceeding release.

# INSTALL

`npm install @ethereumjs/block`

# USAGE

## Introduction

There are three static factories to instantiate a `Block`:

- `Block.fromBlockData(blockData: BlockData = {}, opts?: BlockOptions)`
- `Block.fromRLPSerializedBlock(serialized: Buffer, opts?: BlockOptions)`
- `Block.fromValuesArray(values: BlockBuffer, opts?: BlockOptions)`

For `BlockHeader` instantiation analogue factory methods exists, see API docs linked below.

Instantiation Example:

```typescript
import { BlockHeader } from '@ethereumjs/block'

const headerData = {
  number: 15,
  parentHash: '0x6bfee7294bf44572b7266358e627f3c35105e1c3851f3de09e6d646f955725a7',
  difficulty: 131072,
  gasLimit: 8000000,
  timestamp: 1562422144,
}
const header = BlockHeader.fromHeaderData(headerData)
```

Properties of a `Block` or `BlockHeader` object are frozen with `Object.freeze()` which gives you enhanced security and consistency properties when working with the instantiated object. This behavior can be modified using the `freeze` option in the constructor if needed.

API Usage Example:

```typescript
try {
  await block.validate(blockchain)
  // Block validation has passed
} catch (err) {
  // handle errors appropriately
}
```

## EIP-1559 Blocks

This library supports the creation of [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559) compatible blocks starting with `v3.3.0`.

To instantiate an EIP-1559 block the hardfork parameter on the `Common` instance needs to be explicitly set to `london` (default is still `istanbul`):

```typescript
import { Block } from 'ethereumjs-block'
import Common from '@ethereumjs/common'
const common = new Common({ chain: 'mainnet', hardfork: 'london' })
const block = Block.fromBlockData({
  header: {
    //...,
    baseFeePerGas: new BN(10),
  }
}, { common })
```

EIP-1559 blocks have an extra `baseFeePerGas` field (default: `new BN(7)`) and can encompass `FeeMarketEIP1559Transaction` txs (type `2`) (supported by `@ethereumjs/tx` `v3.2.0` or higher) as well as  `Transaction` legacy txs (internal type `0`) and `AccessListEIP2930Transaction` txs (type `1`).

## Consensus Types

The block library supports the creation as well as format and consensus validation of PoW `ethash` and PoA `clique` blocks.

### Ethash/PoW

An Ethash/PoW block can be instantiated as follows:

```typescript
import { Block } from '@ethereumjs/block'
import Common from '@ethereumjs/common'
const common = new Common({ chain: 'mainnet' })
console.log(common.consensusType()) // 'pow'
console.log(common.consensusAlgorithm()) // 'ethash'
const block = Block.fromBlockData({}, { common })
```

To validate that the difficulty of the block matches the canonical difficulty use `block.validate(blockchain)`.

To calculate the difficulty when creating the block pass in the block option `calcDifficultyFromHeader` with the preceding (parent) `BlockHeader`.

### Clique/PoA (since v3.1.0)

A clique block can be instantiated as follows:

```typescript
import { Block } from '@ethereumjs/block'
import Common from '@ethereumjs/common'
const common = new Common({ chain: 'goerli' })
console.log(common.consensusType()) // 'poa'
console.log(common.consensusAlgorithm()) // 'clique'
const block = Block.fromBlockData({}, { common })
```

For clique PoA `BlockHeader.validate()` function validates the various Clique/PoA-specific properties (`extraData` checks and others, see API documentation) and `BlockHeader.validateConsensus()` can be used to properly validate that a Clique/PoA block has the correct signature.

For sealing a block on instantiation you can use the `cliqueSigner` constructor option:

```typescript
const cliqueSigner = Buffer.from('PRIVATE_KEY_HEX_STRING', 'hex')
const block = Block.fromHeaderData(headerData, { cliqueSigner })
```

Additionally there are the following utility methods for Clique/PoA related functionality in the `BlockHeader` class:

- `BlockHeader.validateCliqueDifficulty(blockchain: Blockchain): boolean`
- `BlockHeader.cliqueSigHash()`
- `BlockHeader.cliqueIsEpochTransition(): boolean`
- `BlockHeader.cliqueExtraVanity(): Buffer`
- `BlockHeader.cliqueExtraSeal(): Buffer`
- `BlockHeader.cliqueEpochTransitionSigners(): Address[]`
- `BlockHeader.cliqueVerifySignature(signerList: Address[]): boolean`
- `BlockHeader.cliqueSigner(): Address`

See the API docs for detailed documentation. Note that these methods will throw if called in a non-Clique/PoA context.

# API

[Documentation](./docs/README.md)

# TESTING

Tests in the `tests` directory are partly outdated and testing is primarily done by running the `BlockchainTests` from within the [@ethereumjs/vm](https://github.com/ethereumjs/ethereumjs-monorepo/tree/master/packages/vm) package.

To avoid bloating this repository with [ethereum/tests](https://github.com/ethereum/tests) JSON files, we usually copy specific JSON files and wrap them with some metadata (source, date, commit hash). There's a helper to aid in that process and can be found at [wrap-ethereum-test.sh](https://github.com/ethereumjs/ethereumjs-monorepo/blob/master/packages/block/scripts/wrap-ethereum-test.sh).

# EthereumJS

See our organizational [documentation](https://ethereumjs.readthedocs.io) for an introduction to `EthereumJS` as well as information on current standards and best practices.

If you want to join for work or do improvements on the libraries have a look at our [contribution guidelines](https://ethereumjs.readthedocs.io/en/latest/contributing.html).

# LICENSE

[MPL-2.0](<https://tldrlegal.com/license/mozilla-public-license-2.0-(mpl-2)>)

[discord-badge]: https://img.shields.io/static/v1?logo=discord&label=discord&message=Join&color=blue
[discord-link]: https://discord.gg/TNwARpR
[block-npm-badge]: https://img.shields.io/npm/v/@ethereumjs/block.svg
[block-npm-link]: https://www.npmjs.com/package/@ethereumjs/block
[block-issues-badge]: https://img.shields.io/github/issues/ethereumjs/ethereumjs-monorepo/package:%20block?label=issues
[block-issues-link]: https://github.com/ethereumjs/ethereumjs-monorepo/issues?q=is%3Aopen+is%3Aissue+label%3A"package%3A+block"
[block-actions-badge]: https://github.com/ethereumjs/ethereumjs-monorepo/workflows/Block/badge.svg
[block-actions-link]: https://github.com/ethereumjs/ethereumjs-monorepo/actions?query=workflow%3A%22Block%22
[block-coverage-badge]: https://codecov.io/gh/ethereumjs/ethereumjs-monorepo/branch/master/graph/badge.svg?flag=block
[block-coverage-link]: https://codecov.io/gh/ethereumjs/ethereumjs-monorepo/tree/master/packages/block
