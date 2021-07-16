# @ethereumjs/common

[![NPM Package][common-npm-badge]][common-npm-link]
[![GitHub Issues][common-issues-badge]][common-issues-link]
[![Actions Status][common-actions-badge]][common-actions-link]
[![Code Coverage][common-coverage-badge]][common-coverage-link]
[![Discord][discord-badge]][discord-link]

| Resources common to all EthereumJS implementations. |
| --- |

Note: this `README` reflects the state of the library from `v2.0.0` onwards. See `README` from the [standalone repository](https://github.com/ethereumjs/ethereumjs-common) for an introduction on the last preceeding release.

# INSTALL

`npm install @ethereumjs/common`

# USAGE

All parameters can be accessed through the `Common` class which can be required through the
main package and instantiated either with just the `chain` (e.g. 'mainnet') or the `chain`
together with a specific `hardfork` provided.

If no hardfork is provided the common is initialized with the default hardfork.

Current `DEFAULT_HARDFORK`: `istanbul`

Here are some simple usage examples:

```typescript
import Common from '@ethereumjs/common'

// Instantiate with the chain (and the default hardfork)
const c = new Common({ chain: 'ropsten' })
c.param('gasPrices', 'ecAddGas') // 500

// Chain and hardfork provided
c = new Common({ chain: 'ropsten', hardfork: 'byzantium' })
c.param('pow', 'minerReward') // 3000000000000000000

// Instantiate with an EIP activated
const c = new Common({ chain: 'mainnet', eips: [2537] })

// Access genesis data for Ropsten network
c.genesis().hash // 0x41941023680923e0fe4d74a34bdac8141f2540e3ae90623718e47d66d1ca4a2d

// Get bootstrap nodes for chain/network
c.bootstrapNodes() // Array with current nodes
```

If the initializing library only supports a certain range of `hardforks` you can use the `supportedHardforks` option to restrict hardfork access on the `Common` instance:

```typescript
const c = new Common({
  chain: 'ropsten',
  supportedHardforks: ['byzantium', 'constantinople', 'petersburg'],
})
```

This will e.g. throw an error when a param is requested for an unsupported hardfork and
like this prevents unpredicted behaviour.

# API

See the API documentation for a full list of functions for accessing specific chain and
depending hardfork parameters. There are also additional helper functions like
`paramByBlock (topic, name, blockNumber)` or `hardforkIsActiveOnBlock (hardfork, blockNumber)`
to ease `blockNumber` based access to parameters.

- [API Docs](./docs/README.md)

# EVENTS

The `Common` class is implemented as an `EventEmitter` and is emitting the following events
on which you can react within your code:

| Event | Description |
| - | - |
| `hardforkChanged` | Emitted when a hardfork change occurs in the Common object |

# SETUP

## Chains

The `chain` can be set in the constructor like this:

```typescript
const c = new Common({ chain: 'ropsten' })
```

Supported chains:

- `mainnet`
- `ropsten`
- `rinkeby`
- `kovan`
- `goerli`
- `calaveras`
- Private/custom chain parameters

The following chain-specific parameters are provided:

- `name`
- `chainId`
- `networkId`
- `consensusType` (e.g. `pow` or `poa`)
- `consensusAlgorithm` (e.g. `ethash` or `clique`)
- `consensusConfig` (depends on `consensusAlgorithm`, e.g. `period` and `epoch` for `clique`)
- `genesis` block header values
- `hardforks` block numbers
- `bootstrapNodes` list
- `dnsNetworks` list ([EIP-1459](https://eips.ethereum.org/EIPS/eip-1459)-compliant list of DNS networks for peer discovery)

To get an overview of the different parameters have a look at one of the chain-specifc
files like `mainnet.json` in the `chains` directory, or to the `Chain` type in [./src/types.ts](./src/types.ts).

### Working with private/custom chains

There are two distinct APIs available for setting up custom(ized) chains.

#### Activate with a single custom Chain setup

If you want to initialize a `Common` instance with a single custom chain which is then directly activated
you can pass a dictionary - conforming to the parameter format described above - with your custom chain 
values to the constructor using the `chain` parameter or the `setChain()` method, here is some example:

```typescript
import myCustomChain from './[PATH]/myCustomChain.json'
const common = new Common({ chain: myCustomChain })
```

If you just want to change certain parameters on a chain configuration it can also be convenient to use
the `Common.forCustomChain()` method. With this method you can base your custom chain configuration with
a standard one (so using all the values from `baseChain` as the default values) and then just provide the
parameters you want to override:

```typescript
const customChainParams = { name: 'custom', chainId: 123, networkId: 678 }
const customChainCommon = Common.forCustomChain('mainnet', customChainParams, 'byzantium')
```

#### Initialize using customChains Array

A second way for custom chain initialization is to use the `customChains` constructor option. This
option comes with more flexibility and allows for an arbitrary number of custom chains to be initialized on
a common instance in addition to the already supported ones. It also allows for an activation-independent 
initialization, so you can add your chains by adding to the `customChains` array and either directly 
use the `chain` option to activate one of the custom chains passed or activate a build in chain 
(e.g. `mainnet`) and switch to other chains - including the custom ones - by using `Common.setChain()`.

```typescript
import myCustomChain1 from './[PATH]/myCustomChain1.json'
import myCustomChain2 from './[PATH]/myCustomChain2.json'
// Add two custom chains, initial mainnet activation
const common1 = new Common({ chain: 'mainnet', customChains: [ myCustomChain1, myCustomChain2 ] })
// Somewhat later down the road...
common1.setChain('customChain1')
// Add two custom chains, activate customChain1
const common1 = new Common({ chain: 'customChain1', customChains: [ myCustomChain1, myCustomChain2 ] })
```

## Hardforks

The `hardfork` can be set in constructor like this:

```typescript
const c = new Common({ chain: 'ropsten', hardfork: 'byzantium' })
```

### Active Hardforks

There are currently parameter changes by the following past and future hardfork by the
library supported:

- `chainstart`
- `homestead`
- `dao`
- `tangerineWhistle`
- `spuriousDragon`
- `byzantium`
- `constantinople`
- `petersburg` (aka `constantinopleFix`, apply together with `constantinople`)
- `istanbul` (`DEFAULT_HARDFORK` (`v2.0.0` release series))
- `muirGlacier`
- `berlin` (since `v2.2.0`)
- `london` (since `v2.4.0`)

### Future Hardforks

The next upcoming HF `shanghai` is currently not yet supported by this library.

### Parameter Access

For hardfork-specific parameter access with the `param()` and `paramByBlock()` functions
you can use the following `topics`:

- `gasConfig`
- `gasPrices`
- `vm`
- `pow`

See one of the hardfork files like `byzantium.json` in the `hardforks` directory
for an overview. For consistency, the chain start (`chainstart`) is considered an own
hardfork.

The hardfork-specific json files only contain the deltas from `chainstart` and
shouldn't be accessed directly until you have a specific reason for it.

## EIPs

Starting with the `v2.0.0` release of the library, EIPs are now native citizens within the library
and can be activated like this:

```typescript
const c = new Common({ chain: 'mainnet', eips: [2537] })
```

The following EIPs are currently supported:

- [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559): Fee market change for ETH 1.0 chain
- [EIP-2315](https://eips.ethereum.org/EIPS/eip-2315): Simple subroutines for the EVM
- [EIP-2537](https://eips.ethereum.org/EIPS/eip-2537): BLS precompiles
- [EIP-2565](https://eips.ethereum.org/EIPS/eip-2565): ModExp gas cost
- [EIP-2718](https://eips.ethereum.org/EIPS/eip-2565): Transaction Types
- [EIP-2929](https://eips.ethereum.org/EIPS/eip-2929): gas cost increases for state access opcodes
- [EIP-2930](https://eips.ethereum.org/EIPS/eip-2930): Optional accesss list tx type
- [EIP-3529](https://eips.ethereum.org/EIPS/eip-3529): Reduction in refunds
- [EIP-3541](https://eips.ethereum.org/EIPS/eip-3541): Reject new contracts starting with the 0xEF byte
- [EIP-3554](https://eips.ethereum.org/EIPS/eip-3554): Difficulty Bomb Delay to December 2021 (only PoW networks)

## Bootstrap Nodes

You can use `common.bootstrapNodes()` function to get nodes for a specific chain/network.

## Genesis States

Network-specific genesis files are located in the `genesisStates` folder.

Due to the large file sizes genesis states are not directly included in the `index.js` file
but have to be accessed directly, e.g.:

```javascript
const mainnetGenesisState = require('@ethereumjs/common/dist/genesisStates/mainnet')
```

Or by accessing dynamically:

```javascript
const genesisStates = require('@ethereumjs/common/dist/genesisStates')
const mainnetGenesisState = genesisStates.genesisStateByName('mainnet')
const mainnetGenesisState = genesisStates.genesisStateById(1) // alternative via network Id
```

# EthereumJS

See our organizational [documentation](https://ethereumjs.readthedocs.io) for an introduction to `EthereumJS` as well as information on current standards and best practices.

If you want to join for work or do improvements on the libraries have a look at our [contribution guidelines](https://ethereumjs.readthedocs.io/en/latest/contributing.html).

# LICENSE

[MIT](https://opensource.org/licenses/MIT)

[discord-badge]: https://img.shields.io/static/v1?logo=discord&label=discord&message=Join&color=blue
[discord-link]: https://discord.gg/TNwARpR
[common-npm-badge]: https://img.shields.io/npm/v/@ethereumjs/common.svg
[common-npm-link]: https://www.npmjs.com/package/@ethereumjs/common
[common-issues-badge]: https://img.shields.io/github/issues/ethereumjs/ethereumjs-monorepo/package:%20common?label=issues
[common-issues-link]: https://github.com/ethereumjs/ethereumjs-monorepo/issues?q=is%3Aopen+is%3Aissue+label%3A"package%3A+common"
[common-actions-badge]: https://github.com/ethereumjs/ethereumjs-monorepo/workflows/Common/badge.svg
[common-actions-link]: https://github.com/ethereumjs/ethereumjs-monorepo/actions?query=workflow%3A%22Common%22
[common-coverage-badge]: https://codecov.io/gh/ethereumjs/ethereumjs-monorepo/branch/master/graph/badge.svg?flag=common
[common-coverage-link]: https://codecov.io/gh/ethereumjs/ethereumjs-monorepo/tree/master/packages/common
