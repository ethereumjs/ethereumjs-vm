# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
(modification: no type change headlines) and this project adheres to
[Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## UNRELEASED

- Fixed `hardforkBlockBN()` to correctly return null for unscheduled hardforks, PR [#1329](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1329)

## 2.3.1 - 2021-06-11

Small feature release.

- Added static helper method `Common.isSupportedChainId()`to check if a chain is natively supported by the Common version installed, PR [#1281](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1281)
- Added support for the `calaveras` ephemeral developer test network (preparing for the `london` HF), PR [#1286](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1286)

## 2.3.0 - 2021-05-26

### London HF Support

This `Common` release comes with full support for the `london` hardfork. Please note that the default HF is still set to `istanbul`. You therefore need to explicitly set the `hardfork` parameter for instantiating a `Common` instance with a `london` HF activated:

```typescript
import Common from '@ethereumjs/common'
const common = new Common({ chain: 'mainnet', hardfork: 'london' })
```

### London HF Changes

Common now supports settings for the following additional EIPs:

- [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559): Fee market change for ETH 1.0 chain, PR [#1148](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1148)
- [EIP-3198](https://eips.ethereum.org/EIPS/eip-3198): BASEFEE opcode, PR [#1148](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1148)
- [EIP-3529](https://eips.ethereum.org/EIPS/eip-3529): Reduction in refunds, PR [#1239](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1239)
- [EIP-3541](https://eips.ethereum.org/EIPS/eip-3541): Reject new contracts starting with the 0xEF byte, PR [#1240](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1240)
- [EIP-3554](https://eips.ethereum.org/EIPS/eip-3554): Difficulty Bomb Delay to December 2021 (only PoW networks), PR [#1245](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1245)

All new EIPs have their dedicated EIP configuration file and can also be activated spearately with the `eips` parameter (and the so-created `common` instance can then e.g. be used within the VM):

```typescript
import Common from '@ethereumjs/common'
const common = new Common({ chain: 'mainnet', hardfork: 'berlin', eips: [ 3529 ] })
```

### Bug Fixes

- Fixed a bug for `Common.hardforkGteHardfork()` and `Common.gteHardfork()` now evaluating to `true` if the HF provided as the `gteHardfork` part is not known by the chain, PR [#1148](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1148)
- Fixed `mainnet` berlin fork hash `0xeb440f6` -> `0x0eb440f6`, PR [#1148](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1148)
- Fixed fork hash calculation in `Common._calcForkHash()` for fork hashes with a leading zero, PR [#1148](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1148)

### Other Changes

- Added `london` HF option, PR [#1148](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1148)
- Added `baikal` test network (preparatory `london` network), PR [#1249](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1249)
- Added `aleut` test network (preparatory `london` network, retired), PR [#1221](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1221)

## 2.2.0 - 2021-03-18

### Berlin HF Support

This `Common` release comes with full support for the `berlin` hardfork. Please note that the default HF is still set to `istanbul`. You therefore need to explicitly set the `hardfork` parameter for instantiating a `Common` instance with a `berlin` HF activated:

```typescript
import Common from '@ethereumjs/common'
const common = new Common({ chain: 'mainnet', hardfork: 'berlin' })
```

**Berlin HF Changes**

- Added final list of `berlin` EIPs (`EIP-2565`, `EIP-2929`, `EIP-2718`, `EIP-2930`), PR [#1124](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1124) and PR [#1048](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1048)
- Corrected base gas costs for `EIP-2929` related opcodes, PR [#1124](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1124)
- New EIP configuration files for `EIP-2718` (typed txs) and `EIP-2930` (optional access lists), PR [#1048](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1048)
- Added `berlin` hardfork block numbers for `mainnet`, `ropsten`, `rinkeby` and `goerli`, PR [#1142](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1142)

### BN Support for high Chain IDs and Block Numbers

The library has been updated to support very high chain IDs and block numbers exceeding the `Number.MAX_SAFE_INTEGER` limit (9007199254740991).

Methods with a respective input parameter now allow for a `BNLike` input (`number` (as before), `Buffer`, (Hex)`String` or `BN`). The following function signatures have been updated:

- `chain` constructor parameter now additionally allowing `BN`
- `setChain(chain: string | number | object)` -> `setChain(chain: string | number | BN | object)`
- `getHardforkByBlockNumber(blockNumber: BNLike): string`
- `setHardforkByBlockNumber(blockNumber: BNLike): string`
- `paramByBlock(topic: string, name: string, blockNumber: BNLike): any`
- `hardforkIsActiveOnBlock(hardfork: string | null, blockNumber: BNLike, opts?: hardforkOptions): boolean`
- `activeOnBlock(blockNumber: BNLike, opts?: hardforkOptions): boolean`
- `activeHardforks(blockNumber?: BNLike | null, opts: hardforkOptions = {}): Array<any>`
- `activeHardfork(blockNumber?: BNLike | null, opts: hardforkOptions = {}): string`
- `isHardforkBlock(blockNumber: BNLike, hardfork?: string): boolean`
- `isNextHardforkBlock(blockNumber: BNLike, hardfork?: string): boolean`

For methods with a respective `number` return value corresponding [METHOD_NAME]BN methods have been added:

- `hardforkBlockBN(hardfork?: string): BN`
- `nextHardforkBlockBN(hardfork?: string): BN | null`
- `chainIdBN(): BN`
- `networkIdBN(): BN`

Note that in the next major release these methods will be unified again by switching to use the original version names for the new BN-output functions.

### Other Changes

- Added chain config and genesis file for `yolov3` testnet, PR [#1129](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1129)
- New `Common.copy()` function to easily receive a deep copy of a `Common` instance, PR [#1144](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1144)

## 2.1.0 - 2021-02-22

### Clique/PoA Support

This release completes on Clique/PoA support (see also Clique/PoA related changes in `v2.0.0`), see PR [#1032](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1032). The chain configuration files (e.g. `chains/goerli.json`) are extended by a consensus algorithm-specific config parameter section, here is a sample `consensus` parameter section, note that the `config` parameter dict must be named after the consensus algorithm:

```json
{
  "consensus": {
    "type": "poa",
    "algorithm": "clique",
    "clique": {
      "period": 15,
      "epoch": 30000
    }
  }
}
```

For now this is done in a backwards-compatible way and the `consensus` parameter section is still marked as optional. You nevertheless might want to add this section already to your custom chain files - even if you don't make usage of the parameters - to remain compatible in the future.

The new parameter section is complemented by a new `Common.consensusConfig()` function to request these parameters in addition to the `Common.consensusType()` and `Common.consensusAlgorithm()` methods introduced in `v2.0.0`.

### Custom Chain File Support

There is now a more convenient and flexible way to integrate custom chains into Common instances complementing the existing `Common.fromCustomChain()` static constructor, see PR [#1034](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1034).

This new way adds a new `customChains` constructor option and can be used as following:

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

The [README section](https://github.com/ethereumjs/ethereumjs-monorepo/tree/master/packages/common#working-with-privatecustom-chains) on working with custom chains has been significantly expanded along the way and is a recommended read if you use common for custom chain initialization.

### New EIPs

#### EIP-1459 DNS Peer Discovery

[EIP-1459](https://eips.ethereum.org/EIPS/eip-1459) introduces a way to discover nodes for an Ethereum network connection via DNS. This release adds a new optional chain config file parameter `dnsNetworks` and an associated method `Common.dnsNetworks()` to request DNS networks for a chain.

#### EIP-2565 ModExp Precompile Gas Costs

[EIP-2565](https://eips.ethereum.org/EIPS/eip-2565) introduces a new algorithm for ModExp precompile gas cost calculation. A new EIP file `eips/2565.json` has been added along the work on PR [#1026](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1026) with respective parameter updates.

### Other Changes

- `Common` is now implemented as an `EventEmitter` and emits a `hardforkChanged` event upon a HF change, PR [#1112](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1112)
- New `Common.isActivatedEIP()` method, PR [#1125](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1125)
- Updated `Goerli` bootnodes, PR [#1031](https://github.com/ethereumjs/ethereumjs-monorepo/pull/1031)

## 2.0.0 - 2020-11-24

### New Package Name

**Attention!** This new version is part of a series of EthereumJS releases all moving to a new scoped package name format. In this case the library is renamed as follows:

- `ethereumjs-common` -> `@ethereumjs/common`

Please update your library references accordingly or install with:

```shell
npm i @ethereumjs/common
```

### New constructor

**Breaking**: The constructor has been changed to require an options dict to be passed, PR [#863](https://github.com/ethereumjs/ethereumjs-monorepo/pull/863)

Example:

```typescript
import Common from '@ethereumjs/common'
const common = new Common({ chain: 'mainnet', hardfork: 'muirGlacier' })
```

### EIP Support

EIPs are now native citizens within the `Common` library, see PRs [#856](https://github.com/ethereumjs/ethereumjs-monorepo/pull/856), [#869](https://github.com/ethereumjs/ethereumjs-monorepo/pull/869) and [#872](https://github.com/ethereumjs/ethereumjs-monorepo/pull/872). Supported EIPs have their own configuration file like the [eips/2537.json](https://github.com/ethereumjs/ethereumjs-monorepo/blob/master/packages/common/src/eips/2537.json) file for the BLS precompile EIP and EIP settings can be activated by passing supported EIP numbers to the constructor:

```typescript
const c = new Common({ chain: 'mainnet', eips: [2537] })
```

The following EIPs are initially supported within this release:

- [EIP-2537](https://eips.ethereum.org/EIPS/eip-2315) BLS Precompiles
- [EIP-2315](https://eips.ethereum.org/EIPS/eip-2315) EVM Subroutines (PR [#876](https://github.com/ethereumjs/ethereumjs-monorepo/pull/876))

EIPs provided are then activated and parameters requested with `Common.param()` being present in these EIPs take precedence over the setting from the latest hardfork.

There are two new utility functions which return hardfork and EIP values respectively:

- `Common.paramByHardfork()`
- `Common.paramByEIP()`

**Breaking**: It is now not possible any more to pass a dedicated HF setting to `Common.param()`. Please update your code to explicitly use `Common.paramByHardfork()` for requesting a parameter for a HF deviating from the HF currently set within your `Common` instance.

For setting and requesting active EIPs there is `Common.setEIPs()` and `Common.eips()` added to the mix.

There is also a new EIP-based hardfork file format which delegates parameter definition to dedicated EIP files (see PR [#876](https://github.com/ethereumjs/ethereumjs-monorepo/pull/876)). This is in preparation for an upcoming `Yolo v2` testnet integration.

Side note: with this new structural setup it gets now possible for all EIPs still implicitly contained within the hardfork files to be extracted as an EIP parameter set within its own dedicated EIP file (which can then be activated via the `eip` parameter on initialization) without loosing on functionality. If you have a need there feel free to open a PR!

### Gas Parameter Completeness for all Hardforks

Remaining gas base fees which still resided in the VM have been moved over to `Common` along PR [#806](https://github.com/ethereumjs/ethereumjs-monorepo/pull/806).

Gas fees for all hardforks up to `MuirGlacier` are now completely present within the `Common` library.

### Eth/64 Forkhash Support

There is a new `Common.forkHash()` method returning pre-calculated Forkhash values or alternatively use the internal `Common._calcForkHash()` implementation to calculate a forkhash on the fly.

Forkhashes are used to uniquely identify a set of hardforks passed to be able to better differentiate between different dedicated chains. This is used for the `Eth/64` devp2p protocol update and specificed in [EIP-2124](https://eips.ethereum.org/EIPS/eip-2124) to help improve the devp2p networking stack.

### New Block/Hardfork related Utility Functions

The following block and hardfork related utility functions have been added with PRs [#863](https://github.com/ethereumjs/ethereumjs-monorepo/pull/863) and [#805](https://github.com/ethereumjs/ethereumjs-monorepo/pull/805) respectively:

- `setHardforkByBlockNumber()` - Sets the hardfork determined by the block number passed
- `nextHardforkBlock()` - Returns the next HF block for a HF provided or set
- `isNextHardforkBlock()` - Some convenience additional utility method, matching the existing `hardforkBlock()` / `isHardforkBlock()` method setup
- `hardforkForForkHash()` - Returns the data available for a HF given a specific forkHash

### Default Hardfork

The default hardfork has been added as an accessible readonly property `DEFAULT_HARDFORK`, PR [#863](https://github.com/ethereumjs/ethereumjs-monorepo/pull/863). This setting is used starting with the latest major releases of the monorepo libraries like the VM to keep the HF setting in sync across the different libraries.

Current default hardfork is set to `istanbul`, PR [#906](https://github.com/ethereumjs/ethereumjs-monorepo/pull/906).

### Dual ES5 and ES2017 Builds

We significantly updated our internal tool and CI setup along the work on PR [#913](https://github.com/ethereumjs/ethereumjs-monorepo/pull/913) with an update to `ESLint` from `TSLint` for code linting and formatting and the introduction of a new build setup.

Packages now target `ES2017` for Node.js builds (the `main` entrypoint from `package.json`) and introduce a separate `ES5` build distributed along using the `browser` directive as an entrypoint, see PR [#921](https://github.com/ethereumjs/ethereumjs-monorepo/pull/921). This will result in performance benefits for Node.js consumers, see [here](https://github.com/ethereumjs/merkle-patricia-tree/pull/117) for a releated discussion.

### Other Changes

**Changes and Refactoring**

- Added consensus information to chains, new functions `Common.consensusType()` for consensus type access ("pow" or "poa") and `Common.consensusAlgorithm()` to get the associated algorithm or protocol (e.g. "ethash" PoW algorithm or "clique" PoA protocol), see PR [#937](https://github.com/ethereumjs/ethereumjs-monorepo/pull/937)
- Removed old `consensus` and `finality` fields, PR [#758](https://github.com/ethereumjs/ethereumjs-monorepo/pull/758)
- Removed old `casper` and `sharding` fields, PR [#762](https://github.com/ethereumjs/ethereumjs-monorepo/pull/762)
- Updated `ethereumjs-util` to v7, PR [#748](https://github.com/ethereumjs/ethereumjs-monorepo/pull/748)

## 2.0.0-rc.1 2020-11-19

This is the first release candidate towards a final library release, see [beta.2](https://github.com/ethereumjs/ethereumjs-monorepo/releases/tag/%40ethereumjs%2Fcommon%402.0.0-beta.2) and especially [beta.1](https://github.com/ethereumjs/ethereumjs-monorepo/releases/tag/%40ethereumjs%2Fcommon%402.0.0-beta.1) release notes for an overview on the full changes since the last publicly released version.

No changes since `beta.2` release.

## 2.0.0-beta.2 - 2020-11-12

This is the second beta release towards a final library release, see [beta.1 release notes](https://github.com/ethereumjs/ethereumjs-monorepo/releases/tag/%40ethereumjs%2Fcommon%402.0.0-beta.1) for an overview on the full changes since the last publicly released version.

- Added consensus information to chains, new functions `Common.consensusType()` for consensus type access ("pow" or "poa") and `Common.consensusAlgorithm()` to get the associated algorithm or protocol (e.g. "ethash" PoW algorithm or "clique" PoA protocol), see PR [#937](https://github.com/ethereumjs/ethereumjs-monorepo/pull/937)

## 2.0.0-beta.1 - 2020-10-22

### New Package Name

**Attention!** This new version is part of a series of EthereumJS releases all moving to a new scoped package name format. In this case the library is renamed as follows:

- `ethereumjs-common` -> `@ethereumjs/common`

Please update your library references accordingly or install with:

```shell
npm i @ethereumjs/common
```

### New constructor

**Breaking**: The constructor has been changed to require an options dict to be passed, PR [#863](https://github.com/ethereumjs/ethereumjs-monorepo/pull/863)

Example:

```typescript
import Common from '@ethereumjs/common'
const common = new Common({ chain: 'mainnet', hardfork: 'muirGlacier' })
```

### EIP Support

EIPs are now native citizens within the `Common` library, see PRs [#856](https://github.com/ethereumjs/ethereumjs-monorepo/pull/856), [#869](https://github.com/ethereumjs/ethereumjs-monorepo/pull/869) and [#872](https://github.com/ethereumjs/ethereumjs-monorepo/pull/872). Supported EIPs have their own configuration file like the [eips/2537.json](https://github.com/ethereumjs/ethereumjs-monorepo/blob/master/packages/common/src/eips/2537.json) file for the BLS precompile EIP and EIP settings can be activated by passing supported EIP numbers to the constructor:

```typescript
const c = new Common({ chain: 'mainnet', eips: [2537] })
```

The following EIPs are initially supported within this release:

- [EIP-2537](https://eips.ethereum.org/EIPS/eip-2315) BLS Precompiles
- [EIP-2315](https://eips.ethereum.org/EIPS/eip-2315) EVM Subroutines (PR [#876](https://github.com/ethereumjs/ethereumjs-monorepo/pull/876))

EIPs provided are then activated and parameters requested with `Common.param()` being present in these EIPs take precedence over the setting from the latest hardfork.

There are two new utility functions which return hardfork and EIP values respectively:

- `Common.paramByHardfork()`
- `Common.paramByEIP()`

**Breaking**: It is now not possible any more to pass a dedicated HF setting to `Common.param()`. Please update your code to explicitly use `Common.paramByHardfork()` for requesting a parameter for a HF deviating from the HF currently set within your `Common` instance.

For setting and requesting active EIPs there is `Common.setEIPs()` and `Common.eips()` added to the mix.

There is also a new EIP-based hardfork file format which delegates parameter definition to dedicated EIP files (see PR [#876](https://github.com/ethereumjs/ethereumjs-monorepo/pull/876)). This is in preparation for an upcoming `Yolo v2` testnet integration.

Side note: with this new structural setup it gets now possible for all EIPs still implicitly contained within the hardfork files to be extracted as an EIP parameter set within its own dedicated EIP file (which can then be activated via the `eip` parameter on initialization) without loosing on functionality. If you have a need there feel free to open a PR!

### Gas Parameter Completeness for all Hardforks

Remaining gas base fees which still resided in the VM have been moved over to `Common` along PR [#806](https://github.com/ethereumjs/ethereumjs-monorepo/pull/806).
Gas fees for all hardforks up to `MuirGlacier` are now completely present within the `Common` library.

### Eth/64 Forkhash Support

There is a new `Common.forkHash()` method returning pre-calculated Forkhash values or alternatively use the internal `Common._calcForkHash()` implementation to calculate a forkhash on the fly.

Forkhashes are used to uniquely identify a set of hardforks passed to be able to better differentiate between different dedicated chains. This is used for the `Eth/64` devp2p protocol update and specificed in [EIP-2124](https://eips.ethereum.org/EIPS/eip-2124) to help improve the devp2p networking stack.

### New Block/Hardfork related Utility Functions

The following block and hardfork related utility functions have been added with PRs [#863](https://github.com/ethereumjs/ethereumjs-monorepo/pull/863) and [#805](https://github.com/ethereumjs/ethereumjs-monorepo/pull/805) respectively:

- `setHardforkByBlockNumber()` - Sets the hardfork determined by the block number passed
- `nextHardforkBlock()` - Returns the next HF block for a HF provided or set
- `isNextHardforkBlock()` - Some convenience additional utility method, matching the existing `hardforkBlock()` / `isHardforkBlock()` method setup
- `hardforkForForkHash()` - Returns the data available for a HF given a specific forkHash

### Default Hardfork

The default hardfork has been added as an accessible readonly property `DEFAULT_HARDFORK`, PR [#863](https://github.com/ethereumjs/ethereumjs-monorepo/pull/863). This setting is used starting with the latest major releases of the monorepo libraries like the VM to keep the HF setting in sync across the different libraries.

Current default hardfork is set to `istanbul`, PR [#906](https://github.com/ethereumjs/ethereumjs-monorepo/pull/906).

### Dual ES5 and ES2017 Builds

We significantly updated our internal tool and CI setup along the work on 
PR [#913](https://github.com/ethereumjs/ethereumjs-monorepo/pull/913) with an update to `ESLint` from `TSLint` 
for code linting and formatting and the introduction of a new build setup.

Packages now target `ES2017` for Node.js builds (the `main` entrypoint from `package.json`) and introduce
a separate `ES5` build distributed along using the `browser` directive as an entrypoint, see
PR [#921](https://github.com/ethereumjs/ethereumjs-monorepo/pull/921). This will result
in performance benefits for Node.js consumers, see [here](https://github.com/ethereumjs/merkle-patricia-tree/pull/117) for a releated discussion.

### Other Changes

**Changes and Refactoring**

- Removed old `consensus` and `finality` fields,
  PR [#758](https://github.com/ethereumjs/ethereumjs-monorepo/pull/758)
- Removed old `casper` and `sharding` fields,
  PR [#762](https://github.com/ethereumjs/ethereumjs-monorepo/pull/762)
- Updated `ethereumjs-util` to v7,
  PR [#748](https://github.com/ethereumjs/ethereumjs-monorepo/pull/748)

## 1.5.2 - 2020-07-26

This is a maintenance release.

- Updates Goerli chain ID, PR [#792](https://github.com/ethereumjs/ethereumjs-monorepo/pull/792).

## [1.5.1] - 2020-05-04

This is a maintenance release.

- Updated bootnode definitions, and more strict checking for their values.
  PR [#718](https://github.com/ethereumjs/ethereumjs-monorepo/pull/718)

[1.5.1]: https://github.com/ethereumjs/ethereumjs-monorepo/compare/%40ethereumjs%2Fcommon%401.5.0...%40ethereumjs%2Fcommon%401.5.1

## [1.5.0] - 2019-12-10

Support for the `MuirGlacier` HF
([EIP-2387](https://eips.ethereum.org/EIPS/eip-2387)) scheduled for January 2020
delaying the difficulty bomb.

Changes:

- Implemented [EIP-2384](https://eips.ethereum.org/EIPS/eip-2384) Difficulty
  Bomb Delay, PR [#75](https://github.com/ethereumjs/ethereumjs-common/pull/75)
- Consistent genesis account balance format, converted from decimal to hex
  where necessary, PR [#73](https://github.com/ethereumjs/ethereumjs-common/pull/73)

[1.5.0]: https://github.com/ethereumjs/ethereumjs-monorepo/compare/%40ethereumjs%2Fcommon%401.4.0...%40ethereumjs%2Fcommon%401.5.0

## [1.4.0] - 2019-11-05

First release with full `Istanbul` support regarding parameter introductions/updates
and HF block numbers set for supported chains.

Relevant PRs:

- Added `Istanbul` block numbers for `mainnet`, `goerli` and `rinkeby`,
  PR [#68](https://github.com/ethereumjs/ethereumjs-common/pull/68)
- Added `Petersburg` and `Constantinople` fork blocks to `rinkeby`,
  PR [#71](https://github.com/ethereumjs/ethereumjs-common/pull/71)
- Added `EIP-2200` (rebalance net-metered SSTORE gas costs) parameters for `Istanbul`,
  PR [#65](https://github.com/ethereumjs/ethereumjs-common/pull/65)

Other noteworthy changes:

- Adding forks (including `Istanbul`) for `kovan`,
  PR [#70](https://github.com/ethereumjs/ethereumjs-common/pull/70)
- Fixed `kovan` genesis state,
  PR [#66](https://github.com/ethereumjs/ethereumjs-common/pull/66)

[1.4.0]: https://github.com/ethereumjs/ethereumjs-monorepo/compare/%40ethereumjs%2Fcommon%401.3.2...%40ethereumjs%2Fcommon%401.4.0

## [1.3.2] - 2019-09-04

**Istanbul** Updates:

- Added gas parameters for `EIP-2200` (rebalanced net-metered SSTORE
  gas costs), PR [#65](https://github.com/ethereumjs/ethereumjs-common/pull/65)
- Renamed hardfork `blake2bRound` (-> `blake2Round`) parameter,
  PR [#63](https://github.com/ethereumjs/ethereumjs-common/pull/63)

Other Changes:

- Fixed `Kovan` genesis state,
  PR [#66](https://github.com/ethereumjs/ethereumjs-common/pull/66)

[1.3.2]: https://github.com/ethereumjs/ethereumjs-monorepo/compare/%40ethereumjs%2Fcommon%401.3.1...%40ethereumjs%2Fcommon%401.3.2

## [1.3.1] - 2019-08-08

Added missing **Istanbul** gas costs for:

- ChainID opcode (EIP-1344, as base param in `hardforks/chainstart.json`)
- Blake2b precompile (EIP-2129/152)
- Calldata gas cost reduction (EIP-2028)

See PR [#58](https://github.com/ethereumjs/ethereumjs-common/pull/58).

[1.3.1]: https://github.com/ethereumjs/ethereumjs-monorepo/compare/%40ethereumjs%2Fcommon%401.3.0...%40ethereumjs%2Fcommon%401.3.1

## [1.3.0] - 2019-06-18

- Add a static factory method `Custom.forCustomChain` to make working with
  custom/private chains easier.

[1.3.0]: https://github.com/ethereumjs/ethereumjs-monorepo/compare/%40ethereumjs%2Fcommon%401.2.1...%40ethereumjs%2Fcommon%401.3.0

## [1.2.1] - 2019-06-03

- Added `Istanbul` HF candidate [EIP-1108](https://eips.ethereum.org/EIPS/eip-1108)
  (`DRAFT`) updated `alt_bn128` precompile gas costs (see `hardforks/istanbul.json`)

[1.2.1]: https://github.com/ethereumjs/ethereumjs-monorepo/compare/%40ethereumjs%2Fcommon%401.2.0...%40ethereumjs%2Fcommon%401.2.1

## [1.2.0] - 2019-05-27

**DRAFT Istanbul Hardfork Support**

Draft support for the upcoming `Istanbul` hardfork planned for October 2019,
use `istanbul` as constructor `hardfork` parameter to activate. Parameters
relevant to new EIPs accepted for the HF will be added along subsequent `1.2.x`
releases, the finalized HF version will be released along a subsequent `1.x.0`
release (likely `1.3.0`).

See new `hardforks/istanbul.json` file as well as PR
[#51](https://github.com/ethereumjs/ethereumjs-common/pull/51).

[1.2.0]: https://github.com/ethereumjs/ethereumjs-monorepo/compare/%40ethereumjs%2Fcommon%401.1.0...%40ethereumjs%2Fcommon%401.2.0

## [1.1.0] - 2019-02-04

**Petersburg Hardfork Support**

This release now supports the new `Petersburg` (aka
`constantinopleFix`) HF removing support for [EIP 1283](https://eips.ethereum.org/EIPS/eip-1283). `Petersburg` is conceptualized
within the library as a separate delta-containing HF, only removing `EIP 1283`
support and containing nothing else. It should therefore always be applied
together with the `Constantinople` HF, either by using the same block number to
update on both (`mainnet` scenario) or applying subsequently on subsequent
block numbers (`ropsten` scenario).

HF related changes (from PR [#44](https://github.com/ethereumjs/ethereumjs-common/pull/44)):

- New `hardforks/petersburg.json` HF file
- `constantinople` and `petersburg` block numbers for `ropsten` and `mainnet`
- Updated tests, new `petersburg` related tests

**Launched/Final Goerli Configuration Support**

The release now supports the final [Goerli](https://github.com/goerli/testnet)
cross-client testnet configuration.

Goerli related changes (from PR [#48](https://github.com/ethereumjs/ethereumjs-common/pull/48)):

- Updated `chains/goerli.json` configuration file (`chainId` -> 5,
  `networkId` -> 5, genesis parameters)
- HF block numbers up to `petersburg` hardfork
- Updated bootstrap nodes
- Updated `genesisStates/goerli.json` genesis state
- Test updates

**Other Changes**

- Fixed a bug in `hardforkGteHardfork()` where non-active hardforks were considered equal to `chainstart` when `onlyActive` is passed, see
  PR [#44](https://github.com/ethereumjs/ethereumjs-common/pull/44)
- Use CLI scripts from ethereumjs-config in package.json, PR
  [#43](https://github.com/ethereumjs/ethereumjs-common/pull/43)

[1.1.0]: https://github.com/ethereumjs/ethereumjs-monorepo/compare/%40ethereumjs%2Fcommon%401.0.0...%40ethereumjs%2Fcommon%401.1.0

## [1.0.0] - 2019-01-23

First `TypeScript` based release of the library (for details see
PR [#38](https://github.com/ethereumjs/ethereumjs-common/pull/38)),
so release coming with type declaration files and additional type safety! 😄

### Breaking Changes

**Library Import**

`TypeScript` handles `ES6` transpilation
[a bit differently](https://github.com/Microsoft/TypeScript/issues/2719) (at the
end: cleaner) than `babel` so `require` syntax of the library slightly changes to:

```javascript
const Common = require('ethereumjs-common').default
```

**Genesis State Import/Usage**

Import path and usage API of genesis state has changed, see also the
[docs](https://github.com/ethereumjs/ethereumjs-common#genesis-states) on this,
PR [#39](https://github.com/ethereumjs/ethereumjs-common/pull/39):

```javascript
const mainnetGenesisState = require('ethereumjs-common/dist/genesisStates/mainnet')
```

Or by accessing dynamically:

```javascript
const genesisStates = require('ethereumjs-common/dist/genesisStates')
const mainnetGenesisState = genesisStates.genesisStateByName('mainnet')
const mainnetGenesisState = genesisStates.genesisStateById(1) // alternative via network Id
```

**Removed `hybridCasper` (draft) hardfork**

Not likely that anyone has used this, but just in case:
The once anticipated `hybridCasper` (draft) hardfork has been removed from the
list of hardforks, see PR [#37](https://github.com/ethereumjs/ethereumjs-common/pull/37)

[1.0.0]: https://github.com/ethereumjs/ethereumjs-monorepo/compare/%40ethereumjs%2Fcommon%400.6.1...%40ethereumjs%2Fcommon%401.0.0

## [0.6.1] - 2018-11-28

- Experimental support for the [Goerli](https://github.com/goerli/testnet) cross-client `PoA` testnet (`chains/goerli.json`), see PR [#31](https://github.com/ethereumjs/ethereumjs-common/pull/31)
- Unified hex-prefixing (so always prefixing with `0x`) of account addresses in genesis files (fixes an issue with state root computation on other libraries), see PR [#32](https://github.com/ethereumjs/ethereumjs-common/issues/32)

[0.6.1]: https://github.com/ethereumjs/ethereumjs-monorepo/compare/%40ethereumjs%2Fcommon%400.6.0...%40ethereumjs%2Fcommon%400.6.1

## [0.6.0] - 2018-10-11

Parameter support for the `Constantinople` hardfork (see `hardforks/constantinople.json`):

- Added `SSTORE` gas/refund prices (`EIP-1283`), PR [#27](https://github.com/ethereumjs/ethereumjs-common/pull/27)
- Added Block Reward Adjustment (`EIP-1234`), PR [#26](https://github.com/ethereumjs/ethereumjs-common/pull/26)

[0.6.0]: https://github.com/ethereumjs/ethereumjs-monorepo/compare/%40ethereumjs%2Fcommon%400.5.0...%40ethereumjs%2Fcommon%400.6.0

## [0.5.0] - 2018-08-27

- Introduces **support for private chains** by allowing to pass a custom dictionary as the `chain` parameter
  in the constructor or the `setChain()` method as an alternative to just passing one of the predefined
  `chain` `String` names (e.g. `mainnet`, `ropsten`), PR [#24](https://github.com/ethereumjs/ethereumjs-common/pull/24)

[0.5.0]: https://github.com/ethereumjs/ethereumjs-monorepo/compare/%40ethereumjs%2Fcommon%400.4.1...%40ethereumjs%2Fcommon%400.5.0

## [0.4.1] - 2018-08-13

- Added `timestamp` field to genesis definitions in chain files, set for `Rinkeby` and `null` for other chains, PR [#21](https://github.com/ethereumjs/ethereumjs-common/pull/21)
- Updated `Ropsten` bootstrap nodes, PR [#20](https://github.com/ethereumjs/ethereumjs-common/pull/20)

[0.4.1]: https://github.com/ethereumjs/ethereumjs-monorepo/compare/%40ethereumjs%2Fcommon%400.4.0...%40ethereumjs%2Fcommon%400.4.1

## [0.4.0] - 2018-06-20

- Remove leftover ...Gas postfix for some gas prices (e.g. `ecAddGas` -> `ecAdd`) to
  be consistent with overall gas price naming

[0.4.0]: https://github.com/ethereumjs/ethereumjs-monorepo/compare/%40ethereumjs%2Fcommon%400.3.1...%40ethereumjs%2Fcommon%400.4.0

## [0.3.1] - 2018-05-28

- Added two alias functions `activeOnBlock()` and `gteHardfork()` when hardfork is set for convenience, PR [#15](https://github.com/ethereumjs/ethereumjs-common/pull/15)
- Added option to dynamically choose genesis state (see `README`), PR [#15](https://github.com/ethereumjs/ethereumjs-common/pull/15)

[0.3.1]: https://github.com/ethereumjs/ethereumjs-monorepo/compare/%40ethereumjs%2Fcommon%400.3.0...%40ethereumjs%2Fcommon%400.3.1

## [0.3.0] - 2018-05-25

- Allow functions like `hardforkIsActiveOnBlock()` - where hardfork is provided as param - also to be run on hardfork set for greater flexibility/comfort, PR [#13](https://github.com/ethereumjs/ethereumjs-common/pull/13)
- New `hardforkGteHardfork()` method for HF order comparisons, PR [#13](https://github.com/ethereumjs/ethereumjs-common/pull/13)

[0.3.0]: https://github.com/ethereumjs/ethereumjs-monorepo/compare/%40ethereumjs%2Fcommon%400.2.0...%40ethereumjs%2Fcommon%400.3.0

## [0.2.0] - 2018-05-14

- New optional initialization parameter `allowedHardforks`, this allows for cleaner client
  library implementations by preventing undefined behaviour, PR [#10](https://github.com/ethereumjs/ethereumjs-common/pull/10)
- Added `activeHardfork()` function to get latest active HF for chain or block, PR [#11](https://github.com/ethereumjs/ethereumjs-common/pull/11)

[0.2.0]: https://github.com/ethereumjs/ethereumjs-monorepo/compare/%40ethereumjs%2Fcommon%400.1.1...%40ethereumjs%2Fcommon%400.2.0

## [0.1.1] - 2018-05-09

- Remove dynamic require to prevent browserify issue, PR [#8](https://github.com/ethereumjs/ethereumjs-common/pull/8)

[0.1.1]: https://github.com/ethereumjs/ethereumjs-monorepo/compare/%40ethereumjs%2Fcommon%400.1.0...%40ethereumjs%2Fcommon%400.1.1

## [0.1.0] - 2018-05-09

- Initial version, this library succeeds the [ethereum/common](https://github.com/ethereumjs/common/issues/12)
  library, being more future-proof through a better structured design

Features:

- Easy chain-/HF-based parameter access
- No parameter changes on library updates (`c.param('gasPrices', 'ecAddGas', 'byzantium')` will always return the same value)
- Ease experimentation/research by allowing to include future HF parameters (already included as draft: `constantinople` and `hybridCasper`) without breaking current installations
- Improved structure for parameter access (mainly through topics like `gasPrices`, `pow`, `sharding`) for better readability/developer overview
- See [README](https://github.com/ethereumjs/ethereumjs-common) and [API Docs](https://github.com/ethereumjs/ethereumjs-common/blob/master/docs/index.md) for a more in-depth feature overview and usage instructions

[0.1.0]: https://github.com/ethereumjs/ethereumjs-monorepo/compare/%40ethereumjs%2Fcommon%406d0df...%40ethereumjs%2F..v0.1.0
