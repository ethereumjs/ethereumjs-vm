const Buffer = require('safe-buffer').Buffer
const async = require('async')
const ethUtil = require('ethereumjs-util')
const BN = ethUtil.BN
const exceptions = require('./exceptions.js')
const { StorageReader } = require('./state')
const EwasmContract = require('./ewasm').Contract
const runEwasm = require('./runEwasm')

const ERROR = exceptions.ERROR

/**
 * runs a CALL operation
 * @method vm.runCall
 * @private
 * @param opts
 * @param opts.block {Block}
 * @param opts.caller {Buffer}
 * @param opts.code {Buffer} this is for CALLCODE where the code to load is different than the code from the to account.
 * @param opts.data {Buffer}
 * @param opts.gasLimit {Buffer | BN.js }
 * @param opts.gasPrice {Buffer}
 * @param opts.origin {Buffer} []
 * @param opts.to {Buffer}
 * @param opts.value {Buffer}
 * @param {Function} cb the callback
 */
module.exports = function (opts, cb) {
  var self = this
  var stateManager = self.stateManager

  var vmResults = {}
  var toAccount
  var toAddress = opts.to
  var createdAddress
  var txValue = opts.value || Buffer.from([0])
  var caller = opts.caller
  var account
  var block = opts.block
  var code = opts.code
  var txData = opts.data
  var gasLimit = opts.gasLimit || new BN(0xffffff)
  gasLimit = new BN(opts.gasLimit) // make sure is a BN
  var gasPrice = opts.gasPrice
  var gasUsed = new BN(0)
  var origin = opts.origin
  var isCompiled = opts.compiled
  var depth = opts.depth
  // opts.suicides is kept for backward compatiblity with pre-EIP6 syntax
  var selfdestruct = opts.selfdestruct || opts.suicides
  var delegatecall = opts.delegatecall || false
  var isStatic = opts.static || false
  var salt = opts.salt || null
  var storageReader = opts.storageReader || new StorageReader(stateManager)

  txValue = new BN(txValue)

  // run and parse
  async.series([
    checkpointState,
    loadFromAccount,
    subTxValue,
    loadToAccount,
    addTxValue,
    loadCode,
    runCode,
    saveCode
  ], parseCallResult)

  function checkpointState (cb) {
    stateManager.checkpoint(cb)
  }

  function loadFromAccount (done) {
    stateManager.getAccount(caller, function (err, fromAccount) {
      account = fromAccount
      done(err)
    })
  }

  function loadToAccount (done) {
    // get receiver's account
    if (!toAddress) {
      // generate a new contract if no `to`
      code = txData
      txData = undefined
      var newNonce = new BN(account.nonce).subn(1)

      if (salt) {
        createdAddress = toAddress = ethUtil.generateAddress2(caller, salt, code)
      } else {
        createdAddress = toAddress = ethUtil.generateAddress(caller, newNonce.toArray())
      }

      checkAccountState(createdAddress, setupNewContract, done)
    } else {
      // else load the `to` account
      stateManager.getAccount(toAddress, function (err, account) {
        toAccount = account
        done(err)
      })
    }
  }

  function checkAccountState (address, next, done) {
    stateManager.getAccount(address, function (err, account) {
      if (err) {
        done(err)
        return
      }

      if ((account.nonce && new BN(account.nonce) > 0) || account.codeHash.compare(ethUtil.KECCAK256_NULL) !== 0) {
        toAccount = account
        code = new Buffer('fe', 'hex') // Invalid init code
        done()
        return
      }

      next(address, done)
    })
  }

  function setupNewContract (address, done) {
    stateManager.clearContractStorage(address, function (err) {
      if (err) {
        done(err)
        return
      }

      async.series([
        newContractEvent,
        getAccount
      ], done)

      function newContractEvent (callback) {
        self.emit('newContract', {
          address: address,
          code: code
        }, callback)
      }

      function getAccount (callback) {
        stateManager.getAccount(address, function (err, account) {
          toAccount = account
          toAccount.nonce = new BN(toAccount.nonce).addn(1).toArrayLike(Buffer)
          callback(err)
        })
      }
    })
  }

  function subTxValue (cb) {
    if (delegatecall) {
      cb()
      return
    }
    var newBalance = new BN(account.balance).sub(txValue)
    account.balance = newBalance
    stateManager.putAccount(ethUtil.toBuffer(caller), account, cb)
  }

  function addTxValue (cb) {
    if (delegatecall) {
      cb()
      return
    }
    // add the amount sent to the `to` account
    var newBalance = new BN(toAccount.balance).add(txValue)
    if (newBalance.gt(ethUtil.MAX_INTEGER)) {
      cb(new Error('Value overflow'))
      return
    }
    toAccount.balance = newBalance
    // putAccount as the nonce may have changed for contract creation
    stateManager.putAccount(ethUtil.toBuffer(toAddress), toAccount, cb)
  }

  function loadCode (cb) {
    // loads the contract's code if the account is a contract
    if (code || !(toAccount.isContract() || self._precompiled[toAddress.toString('hex')])) {
      cb()
      return
    }

    if (self._precompiled[toAddress.toString('hex')]) {
      isCompiled = true
      code = self._precompiled[toAddress.toString('hex')]
      cb()
      return
    }

    stateManager.getContractCode(toAddress, function (err, c, comp) {
      if (err) return cb(err)
      isCompiled = comp
      code = c
      cb()
    })
  }

  function runCode (cb) {
    if (!code) {
      vmResults.exception = 1
      stateManager.commit(cb)
      return
    }

    var runCodeOpts = {
      code: code,
      data: txData,
      gasLimit: gasLimit,
      gasPrice: gasPrice,
      address: toAddress,
      origin: origin,
      caller: caller,
      value: txValue.toArrayLike(Buffer),
      block: block,
      depth: depth,
      selfdestruct: selfdestruct,
      static: isStatic,
      storageReader: storageReader
    }

    // run Code through vm
    let codeRunner
    if (isCompiled) {
      codeRunner = code instanceof EwasmContract ? runEwasm : self.runJIT
    } else {
      codeRunner = self.runCode
    }
    codeRunner.call(self, runCodeOpts, parseRunResult)

    function parseRunResult (err, results) {
      vmResults = results

      if (createdAddress) {
        // fee for size of the return value
        var totalGas = results.gasUsed
        if (!results.runState.vmError) {
          var returnFee = new BN(results.return.length * self._common.param('gasPrices', 'createData'))
          totalGas = totalGas.add(returnFee)
        }
        // if not enough gas
        if (totalGas.lte(gasLimit) && (self.allowUnlimitedContractSize || results.return.length <= 24576)) {
          results.gasUsed = totalGas
        } else {
          results.return = Buffer.alloc(0)
          // since Homestead
          results.exception = 0
          err = results.exceptionError = ERROR.OUT_OF_GAS
          results.gasUsed = gasLimit
        }
      }

      gasUsed = results.gasUsed
      if (err) {
        results.logs = []
        stateManager.revert(function (revertErr) {
          if (revertErr || !isCompiled) cb(revertErr)
          else {
            // Empty precompiled contracts need to be deleted even in case of OOG
            // because the bug in both Geth and Parity led to deleting RIPEMD precompiled in this case
            // see https://github.com/ethereum/go-ethereum/pull/3341/files#diff-2433aa143ee4772026454b8abd76b9dd
            // We mark the account as touched here, so that is can be removed among other touched empty accounts (after tx finalization)
            if (err === ERROR.OUT_OF_GAS || err.error === ERROR.OUT_OF_GAS) {
              stateManager.getAccount(toAddress, (getErr, acc) => {
                if (getErr) cb(getErr)
                else stateManager.putAccount(toAddress, acc, cb)
              })
            } else {
              cb()
            }
          }
        })
      } else {
        stateManager.commit(cb)
      }
    }
  }

  function saveCode (cb) {
    // store code for a new contract
    if (createdAddress && !vmResults.runState.vmError && vmResults.return && vmResults.return.toString() !== '') {
      stateManager.putContractCode(createdAddress, vmResults.return, cb)
    } else {
      cb()
    }
  }

  function parseCallResult (err) {
    if (err) return cb(err)
    var results = {
      gasUsed: gasUsed,
      createdAddress: createdAddress,
      vm: vmResults
    }

    cb(null, results)
  }
}
