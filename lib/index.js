const Buffer = require('safe-buffer').Buffer
const util = require('util')
const ethUtil = require('ethereumjs-util')
const { StateManager } = require('./state')
const Common = require('ethereumjs-common').default
const Account = require('ethereumjs-account')
const AsyncEventEmitter = require('async-eventemitter')
const Trie = require('merkle-patricia-tree/secure.js')
const fakeBlockchain = require('./fakeBlockChain.js')
const BN = ethUtil.BN

// require the precompiled contracts
const num01 = require('./precompiled/01-ecrecover.js')
const num02 = require('./precompiled/02-sha256.js')
const num03 = require('./precompiled/03-ripemd160.js')
const num04 = require('./precompiled/04-identity.js')
const num05 = require('./precompiled/05-modexp.js')
const num06 = require('./precompiled/06-ecadd.js')
const num07 = require('./precompiled/07-ecmul.js')
const num08 = require('./precompiled/08-ecpairing.js')

module.exports = VM

VM.deps = {
  ethUtil: ethUtil,
  Account: require('ethereumjs-account'),
  Trie: require('merkle-patricia-tree'),
  rlp: require('ethereumjs-util').rlp
}

/**
 * VM Class, `new VM(opts)` creates a new VM object
 * @method VM
 * @param {Object} opts
 * @param {StateManager} opts.stateManager a [`StateManager`](stateManager.md) instance to use as the state store (Beta API)
 * @param {Trie} opts.state a merkle-patricia-tree instance for the state tree (ignored if stateManager is passed)
 * @param {Blockchain} opts.blockchain a blockchain object for storing/retrieving blocks (ignored if stateManager is passed)
 * @param {String|Number} opts.chain the chain the VM operates on [default: 'mainnet']
 * @param {String} opts.hardfork hardfork rules to be used [default: 'byzantium', supported: 'byzantium', 'constantinople', 'petersburg' (will throw on unsupported)]
 * @param {Boolean} opts.activatePrecompiles create entries in the state tree for the precompiled contracts
 * @param {Boolean} opts.allowUnlimitedContractSize allows unlimited contract sizes while debugging. By setting this to `true`, the check for contract size limit of 24KB (see [EIP-170](https://git.io/vxZkK)) is bypassed. (default: `false`; ONLY set to `true` during debugging)
 * @param {Boolean} opts.emitFreeLogs Changes the behavior of the LOG opcode, the gas cost of the opcode becomes zero and calling it using STATICCALL won't throw. (default: `false`; ONLY set to `true` during debugging)
 * @param {Boolean} opts.enableEwasmPrecompiles enable EWASM precompiles. (default: `false`; Experimental feature)
 */
function VM (opts = {}) {
  this.opts = opts

  let chain = opts.chain ? opts.chain : 'mainnet'
  let hardfork = opts.hardfork ? opts.hardfork : 'byzantium'
  let supportedHardforks = [
    'byzantium',
    'constantinople',
    'petersburg'
  ]
  this._common = new Common(chain, hardfork, supportedHardforks)

  if (opts.stateManager) {
    this.stateManager = opts.stateManager
  } else {
    var trie = opts.state || new Trie()
    if (opts.activatePrecompiles) {
      for (var i = 1; i <= 8; i++) {
        trie.put(new BN(i).toArrayLike(Buffer, 'be', 20), new Account().serialize())
      }
    }
    this.stateManager = new StateManager({ trie, common: this._common })
  }

  this.blockchain = opts.blockchain || fakeBlockchain

  this.allowUnlimitedContractSize = opts.allowUnlimitedContractSize === undefined ? false : opts.allowUnlimitedContractSize
  this.emitFreeLogs = opts.emitFreeLogs === undefined ? false : opts.emitFreeLogs

  // precompiled contracts
  this._precompiled = {}
  this._precompiled['0000000000000000000000000000000000000001'] = num01
  this._precompiled['0000000000000000000000000000000000000002'] = num02
  this._precompiled['0000000000000000000000000000000000000003'] = num03
  this._precompiled['0000000000000000000000000000000000000004'] = num04
  this._precompiled['0000000000000000000000000000000000000005'] = num05
  this._precompiled['0000000000000000000000000000000000000006'] = num06
  this._precompiled['0000000000000000000000000000000000000007'] = num07
  this._precompiled['0000000000000000000000000000000000000008'] = num08

  if (opts.enableEwasmPrecompiles) {
    const ewasmPrecompiles = require('./ewasm').precompiles
    Object.assign(this._precompiled, ewasmPrecompiles)
  }

  AsyncEventEmitter.call(this)
}

util.inherits(VM, AsyncEventEmitter)

VM.prototype.runCode = require('./runCode.js')
VM.prototype.runJIT = require('./runJit.js')
VM.prototype.runBlock = require('./runBlock.js')
VM.prototype.runTx = require('./runTx.js')
VM.prototype.runCall = require('./runCall.js')
VM.prototype.runBlockchain = require('./runBlockchain.js')

VM.prototype.copy = function () {
  return new VM({ stateManager: this.stateManager.copy(), blockchain: this.blockchain })
}
