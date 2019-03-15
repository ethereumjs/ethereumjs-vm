const async = require('async')
const testUtil = require('./util')
const Trie = require('merkle-patricia-tree/secure')
const ethUtil = require('ethereumjs-util')
const Account = require('ethereumjs-account')
const BN = ethUtil.BN
const { getRequiredForkConfigAlias } = require('./util')

function parseTestCases (forkConfig, testData, data, gasLimit, value) {
  let testCases = []
  if (testData['post'][forkConfig]) {
    testCases = testData['post'][forkConfig].map(testCase => {
      let testIndexes = testCase['indexes']
      let tx = Object.assign({}, testData.transaction)
      if (data !== undefined && testIndexes['data'] !== data) {
        return null
      }

      if (value !== undefined && testIndexes['value'] !== value) {
        return null
      }

      if (gasLimit !== undefined && testIndexes['gas'] !== gasLimit) {
        return null
      }

      tx.data = testData.transaction.data[testIndexes['data']]
      tx.gasLimit = testData.transaction.gasLimit[testIndexes['gas']]
      tx.value = testData.transaction.value[testIndexes['value']]
      return {
        'transaction': tx,
        'postStateRoot': testCase['hash'],
        'env': testData['env'],
        'pre': testData['pre']
      }
    })
  }

  testCases = testCases.filter(testCase => {
    return testCase != null
  })

  return testCases
}

function runTestCase (options, testData, t, cb) {
  const state = new Trie()
  let block, vm

  async.series([
    function (done) {
      var VM
      if (options.dist) {
        VM = require('../dist/index.js')
      } else {
        VM = require('../lib/index.js')
      }
      vm = new VM({
        state: state,
        hardfork: options.forkConfig.toLowerCase(),
        enableEwasmPrecompiles: options.enableEwasmPrecompiles
      })
      testUtil.setupPreConditions(state, testData, done)
    },
    function (done) {
      var tx = testUtil.makeTx(testData.transaction)
      block = testUtil.makeBlockFromEnv(testData.env)
      tx._homestead = true
      tx.enableHomestead = true
      block.isHomestead = function () {
        return true
      }

      if (tx.validate()) {
        if (options.jsontrace) {
          vm.on('step', function (e) {
            let hexStack = []
            hexStack = e.stack.map(item => {
              return '0x' + new BN(item).toString(16, 0)
            })

            var opTrace = {
              'pc': e.pc,
              'op': e.opcode.opcode,
              'gas': '0x' + e.gasLeft.toString('hex'),
              'gasCost': '0x' + e.opcode.fee.toString(16),
              'stack': hexStack,
              'depth': e.depth,
              'opName': e.opcode.name
            }

            t.comment(JSON.stringify(opTrace))
          })
          vm.on('afterTx', function (results) {
            let stateRoot = {
              'stateRoot': results.vm.runState.stateManager._trie.root.toString('hex')
            }
            t.comment(JSON.stringify(stateRoot))
          })
        }
        vm.runTx({
          tx: tx,
          block: block
        }, function (err, r) {
          // If tx is invalid and coinbase is empty, the test harness
          // expects the coinbase account to be deleted from state.
          // Without this ecmul_0-3_5616_28000_96 would fail.
          if (err) {
            vm.stateManager.getAccount(block.header.coinbase, function (err, account) {
              if (err) {
                done()
                return
              }
              if (new BN(account.balance).isZero()) {
                async.series([
                  (cb) => vm.stateManager.putAccount(block.header.coinbase, new Account(), cb),
                  (cb) => vm.stateManager.cleanupTouchedAccounts(cb),
                  (cb) => vm.stateManager._cache.flush(cb)
                ], (err) => {
                  err = null
                  done()
                })
              } else {
                done()
              }
            })
          } else {
            done()
          }
        })
      } else {
        done()
      }
    },
    function (done) {
      if (testData.postStateRoot.substr(0, 2) === '0x') {
        testData.postStateRoot = testData.postStateRoot.substr(2)
      }
      t.equal(state.root.toString('hex'), testData.postStateRoot, 'the state roots should match')

      if (state.root.toString('hex') !== testData.postStateRoot.toString('hex')) {
        // since General State Tests, postState keys are no longer included in
        // the state test format. only postStateRoot, so can't debug expected post conditions
        // testUtil.verifyPostConditions(state, testData.post, t, done)
        done()
      } else {
        done()
      }
    }
  ], cb)
}

module.exports = function runStateTest (options, testData, t, cb) {
  const forkConfig = getRequiredForkConfigAlias(options.forkConfig)
  try {
    const testCases = parseTestCases(forkConfig, testData, options.data, options.gasLimit, options.value)
    if (testCases.length > 0) {
      async.eachSeries(testCases,
                      (testCase, done) => runTestCase(options, testCase, t, done),
                      cb)
    } else {
      t.comment(`No ${forkConfig} post state defined, skip test`)
      cb()
    }
  } catch (e) {
    t.fail('error running test case for fork: ' + forkConfig)
    console.log('error:', e)
    cb()
  }
}
