# @ethereumjs/tx

[![NPM Package][tx-npm-badge]][tx-npm-link]
[![GitHub Issues][tx-issues-badge]][tx-issues-link]
[![Actions Status][tx-actions-badge]][tx-actions-link]
[![Code Coverage][tx-coverage-badge]][tx-coverage-link]
[![Discord][discord-badge]][discord-link]

| Implements schema and functions related to Ethereum's transaction. |
| --- |

Note: this `README` reflects the state of the library from `v3.0.0` onwards. See `README` from the [standalone repository](https://github.com/ethereumjs/ethereumjs-tx) for an introduction on the last preceeding release.

# INSTALL

`npm install @ethereumjs/tx`

# USAGE

## Setup

### Static Constructor Methods

To instantiate a tx it is not recommended to use the constructor directly. Instead each tx type comes with the following set of static constructor methods which helps on instantiation depending on the input data format:

- `public static fromTxData(txData: TxData, opts: TxOptions = {})`: instantiate from a data dictionary
- `public static fromSerializedTx(serialized: Buffer, opts: TxOptions = {})`: instantiate from a serialized tx
- `public static fromValuesArray(values: Buffer[], opts: TxOptions = {})`: instantiate from a values array

See one of the code examples on the tx types below on how to use.

All types of transaction objects are frozen with `Object.freeze()` which gives you enhanced security and consistency properties when working with the instantiated object. This behavior can be modified using the `freeze` option in the constructor if needed.

### Chain and Hardfork Support

The `Transaction` constructor receives a parameter of an [`@ethereumjs/common`](https://github.com/ethereumjs/ethereumjs-monorepo/blob/master/packages/common) object that lets you specify the chain and hardfork to be used. If there is no `Common` provided the chain ID provided as a paramter on typed tx or the chain ID derived from the `v` value on signed EIP-155 conforming legacy txs will be taken (introduced in `v3.2.1`). In other cases the chain defaults to `mainnet`.

Base default HF (determined by `Common`): `istanbul`

Starting with `v3.2.1` the tx library now deviates from the default HF for typed tx using the following rule: "The default HF is the default HF from `Common` if the tx type is active on that HF. Otherwise it is set to the first greater HF where the tx is active."

Supported Hardforks:

Hardfork | Introduced | Description
--- | --- | ---
`london` | `v3.2.0` | `EIP-1559` Transactions 
`berlin` | `v3.1.0` | `EIP-2718` Typed Transactions, Optional Access Lists Tx Type `EIP-2930`
`muirGlacier` | `v2.1.2` | -
`istanbul` | `v2.1.1` | Support for reduced non-zero call data gas prices ([EIP-2028](https://eips.ethereum.org/EIPS/eip-2028))
`spuriousDragon` | `v2.0.0` | `EIP-155` replay protection (disable by setting HF pre-`spuriousDragon`)

## Transaction Types

This library supports the following transaction types ([EIP-2718](https://eips.ethereum.org/EIPS/eip-2718)):

- `FeeMarketEIP1559Transaction` ([EIP-1559](https://eips.ethereum.org/EIPS/eip-1559), gas fee market)
- `AccessListEIP2930Transaction` ([EIP-2930](https://eips.ethereum.org/EIPS/eip-2930), optional access lists)
- `Transaction`, the Ethereum standard tx up to `berlin`, now referred to as legacy txs with the introduction of tx types

Please note that up to `v3.2.0` you mandatorily had to use a `Common` instance for typed tx instantiation and set the `hardfork` in `Common` to minimally `berlin` (`EIP-2930`) respectively `london` (`EIP-1559`) to allow for typed tx instantiation, since the current `Common` release series v2 (tx type support introduced with `v2.2.0`) still defaults to `istanbul` for backwards-compatibility reasons (also see tx default HF section below).

#### Gas Fee Market Transactions (EIP-1559)

- Class: `FeeMarketEIP1559Transaction`
- Activation: `london`
- Type: `2`

This is the recommended tx type starting with the activation of the `london` HF, see the following code snipped for an example on how to instantiate:

```typescript
import Common from '@ethereumjs/common'
import { FeeMarketEIP1559Transaction } from '@ethereumjs/tx'

const common = new Common({ chain: 'mainnet', hardfork: 'london' })

const txData = {
  "data": "0x1a8451e600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
  "gasLimit": "0x02625a00",
  "maxPriorityFeePerGas": "0x01",
  "maxFeePerGas": "0xff",
  "nonce": "0x00",
  "to": "0xcccccccccccccccccccccccccccccccccccccccc",
  "value": "0x0186a0",
  "v": "0x01",
  "r": "0xafb6e247b1c490e284053c87ab5f6b59e219d51f743f7a4d83e400782bc7e4b9",
  "s": "0x479a268e0e0acd4de3f1e28e4fac2a6b32a4195e8dfa9d19147abe8807aa6f64",
  "chainId": "0x01",
  "accessList": [],
  "type": "0x02"
}

const tx = FeeMarketEIP1559Transaction.fromTxData(txData, { common })
```

#### Access List Transactions (EIP-2930)

- Class: `AccessListEIP2930Transaction`
- Activation: `berlin`
- Type: `1`

This transaction type has been introduced along the `berlin` HF. See the following code snipped for an example on how to instantiate:

```typescript
import Common from '@ethereumjs/common'
import { AccessListEIP2930Transaction } from '@ethereumjs/tx'

const common = new Common({ chain: 'mainnet', hardfork: 'berlin' })

const txData = {
  "data": "0x1a8451e600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
  "gasLimit": "0x02625a00",
  "gasPrice": "0x01",
  "nonce": "0x00",
  "to": "0xcccccccccccccccccccccccccccccccccccccccc",
  "value": "0x0186a0",
  "v": "0x01",
  "r": "0xafb6e247b1c490e284053c87ab5f6b59e219d51f743f7a4d83e400782bc7e4b9",
  "s": "0x479a268e0e0acd4de3f1e28e4fac2a6b32a4195e8dfa9d19147abe8807aa6f64",
  "chainId": "0x01",
  "accessList": [
    {
      "address": "0x0000000000000000000000000000000000000101",
      "storageKeys": [
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        "0x00000000000000000000000000000000000000000000000000000000000060a7"
      ]
    }
  ],
  "type": "0x01"
}

const tx = AccessListEIP2930Transaction.fromTxData(txData, { common })
```

For generating access lists from tx data based on a certain network state there is a `reportAccessList` option
on the `Vm.runTx()` method of the `@ethereumjs/vm` `TypeScript` VM implementation.

### Legacy Transactions

- Class: `Transaction`
- Activation: `chainstart` (with modifications along the road, see HF section below)
- Type: `0` (internal)

Legacy transaction are still valid transaction within Ethereum `mainnet` but will likely be deprecated at some point.
See this [example script](./examples/transactions.ts) or the following code example on how to use.

```typescript
import Common from '@ethereumjs/common'
import { Transaction } from '@ethereumjs/tx'

const txParams = {
  nonce: '0x00',
  gasPrice: '0x09184e72a000',
  gasLimit: '0x2710',
  to: '0x0000000000000000000000000000000000000000',
  value: '0x00',
  data: '0x7f7465737432000000000000000000000000000000000000000000000000000000600057',
}

const common = new Common({ chain: 'mainnet' })
const tx = Transaction.fromTxData(txParams, { common })

const privateKey = Buffer.from(
  'e331b6d69882b4cb4ea581d88e0b604039a3de5967688d3dcffdd2270c0fd109',
  'hex',
)

const signedTx = tx.sign(privateKey)

const serializedTx = signedTx.serialize()
```

### Transaction Factory

If you only know on runtime which tx type will be used within your code or if you want to keep your code transparent to tx types, this library comes with a `TransactionFactory` for your convenience which can be used as follows:

```typescript
import Common from '@ethereumjs/common'
import { TransactionFactory } from '@ethereumjs/tx'

const common = new Common({ chain: 'mainnet', hardfork: 'berlin' })

const txData = {} // Use data from the different tx type examples
const tx = TransactionFactory.fromTxData(txData, { common })

if (tx.supports(Capability.EIP2930AccessLists)) {
  // Do something which only makes sense for txs with support for access lists
}
```

The correct tx type class for instantiation will then be chosen on runtime based on the data provided as an input.

`TransactionFactory` supports the following static constructor methods:

- `public static fromTxData(txData: TxData | AccessListEIP2930TxData, txOptions: TxOptions = {}): TypedTransaction`
- `public static fromSerializedData(data: Buffer, txOptions: TxOptions = {}): TypedTransaction`
- `public static fromBlockBodyData(data: Buffer | Buffer[], txOptions: TxOptions = {})`

## Sending a Transaction

### L2 Support

This library has been tested to work with various L2 networks (`v3.3.0`+). All predefined supported custom chains introduced with `Common` `v2.4.0` or higher are supported, the following is a simple example to send a tx to the xDai chain:

```typescript
import { Transaction } from '@ethereumjs/tx'
import Common from '@ethereumjs/common'

const from = 'PUBLIC_KEY'
const PRIV_KEY = process.argv[2]
const to = 'DESTINATION_ETHEREUM_ADDRESS'

const common = Common.custom(CustomChain.xDaiChain)

const txData = {
  from,
  nonce: 0,
  gasPrice: 1000000000,
  gasLimit: 21000,
  to,
  value: 1,
}

const tx = Transaction.fromTxData(txData, { common })
const signedTx = tx.sign(Buffer.from(PRIV_KEY, 'hex'))
```

The following L2 networks have been tested to work with `@ethereumjs/tx`, see usage examples as well as some notes on pecularities in the issues linked below:

| L2 Network | Common name | Issue |
|---|---|---|
| Arbitrum Rinkeby Testnet | `CustomChain.ArbitrumRinkebyTestnet` | [#1290](https://github.com/ethereumjs/ethereumjs-monorepo/issues/1290) |
| Polygon Mainnet | `CustomChain.PolygonMainnet` | [#1289](https://github.com/ethereumjs/ethereumjs-monorepo/issues/1289) |
| Polygon Mumbai Testnet | `CustomChain.PolygonMumbai` | [#1289](https://github.com/ethereumjs/ethereumjs-monorepo/issues/1289) |
| xDai Chain | `Common.xDaiChain` | [#1323](https://github.com/ethereumjs/ethereumjs-monorepo/issues/1323) |



For a non-predefined custom chain it is also possible to just provide a chain ID as well as other parameters to `Common`:

```typescript
const common = Common.custom({ chainId: 1234 })
```

## Special Topics

### Fake Transaction

Creating a fake transaction for use in e.g. `VM.runTx()` is simple, just overwrite `getSenderAddress()` with a custom [`Address`](https://github.com/ethereumjs/ethereumjs-util/blob/master/docs/classes/_address_.address.md) like so:

```typescript
import { Address } from 'ethereumjs-util'
import { Transaction } from '@ethereumjs/tx'

_getFakeTransaction(txParams: TxParams): Transaction {
  const from = Address.fromString(txParams.from)
  delete txParams.from

  const opts = { common: this._common }
  const tx = Transaction.fromTxData(txParams, opts)

  const fakeTx = Object.create(tx)
  // override getSenderAddress
  fakeTx.getSenderAddress = () => { return from }
  return fakeTx
}
```

# API

[Documentation](./docs/README.md)

# EthereumJS

See our organizational [documentation](https://ethereumjs.readthedocs.io) for an introduction to `EthereumJS` as well as information on current standards and best practices.

If you want to join for work or do improvements on the libraries have a look at our [contribution guidelines](https://ethereumjs.readthedocs.io/en/latest/contributing.html).

# LICENSE

[MPL-2.0](<https://tldrlegal.com/license/mozilla-public-license-2.0-(mpl-2)>)

[discord-badge]: https://img.shields.io/static/v1?logo=discord&label=discord&message=Join&color=blue
[discord-link]: https://discord.gg/TNwARpR
[tx-npm-badge]: https://img.shields.io/npm/v/@ethereumjs/tx.svg
[tx-npm-link]: https://www.npmjs.com/package/@ethereumjs/tx
[tx-issues-badge]: https://img.shields.io/github/issues/ethereumjs/ethereumjs-monorepo/package:%20tx?label=issues
[tx-issues-link]: https://github.com/ethereumjs/ethereumjs-monorepo/issues?q=is%3Aopen+is%3Aissue+label%3A"package%3A+tx"
[tx-actions-badge]: https://github.com/ethereumjs/ethereumjs-monorepo/workflows/Tx/badge.svg
[tx-actions-link]: https://github.com/ethereumjs/ethereumjs-monorepo/actions?query=workflow%3A%22Tx%22
[tx-coverage-badge]: https://codecov.io/gh/ethereumjs/ethereumjs-monorepo/branch/master/graph/badge.svg?flag=tx
[tx-coverage-link]: https://codecov.io/gh/ethereumjs/ethereumjs-monorepo/tree/master/packages/tx
