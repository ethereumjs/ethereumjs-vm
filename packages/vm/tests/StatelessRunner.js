const ethUtil = require('ethereumjs-util')
const BN = ethUtil.BN
const { getRequiredForkConfigAlias, setupPreConditions, makeTx, makeBlockFromEnv } = require('./util')
const Account = require('@ethereumjs/account').default
const Trie = require('merkle-patricia-tree').SecureTrie
const { default: Common } = require('@ethereumjs/common')
const { default: VM } = require('../dist/index.js')
const { default: DefaultStateManager } = require('../dist/state/stateManager')

async function runTestCase (options, testData, t) {
  let expectedPostStateRoot = testData.postStateRoot
  if (expectedPostStateRoot.substr(0, 2) === '0x') {
    expectedPostStateRoot = expectedPostStateRoot.substr(2)
  }

  // Prepare tx and block
  let tx = makeTx(testData.transaction)
  let block = makeBlockFromEnv(testData.env)
  if (!tx.validate()) {
    return
  }

  const common = new Common('mainnet', options.forkConfigVM.toLowerCase())
  const stateManager = new DefaultStateManager({ common: common })
  await setupPreConditions(stateManager._trie, testData)
  const preStateRoot = stateManager._trie.root

  // Set up VM
  let vm = new VM({
    stateManager: stateManager,
    common: common
  })
  if (options.jsontrace) {
    hookVM(vm, t)
  }

  // Determine set of all node hashes in the database
  // before running the tx.
  const existingKeys = new Set()
  const it = stateManager._trie.db.iterator()
  const next = promisify(it.next.bind(it))
  while (true) {
    const key = await next()
    if (!key) break
    existingKeys.add(key.toString('hex'))
  }

  // Hook leveldb.get and add any node that was fetched during execution
  // to a bag of proof nodes, under the condition that this node existed
  // before execution.
  const proofNodes = new Map()
  const getFunc = stateManager._trie.db.get.bind(stateManager._trie.db)
  stateManager._trie.db.get = (key, opts, cb) => {
    getFunc(key, opts, (err, v) => {
      if (!err && v) {
        if (existingKeys.has(key.toString('hex'))) {
          proofNodes.set(key.toString('hex'), v)
        }
      }
      cb(err, v)
    })
  }

  try {
    await vm.runTx({ tx: tx, block: block })
  } catch (err) {
    await deleteCoinbase(new PStateManager(stateManager), block.header.coinbase)
  }
  t.equal(stateManager._trie.root.toString('hex'), expectedPostStateRoot, 'the state roots should match')

  // Save bag of proof nodes to a new trie's underlying leveldb
  const trie = new Trie(null, preStateRoot)
  const opStack = []
  for (const [k, v] of proofNodes) {
    opStack.push({ type: 'put', key: Buffer.from(k, 'hex'), value: v })
  }
  await promisify(trie.db.batch.bind(trie.db))(opStack)

  stateManager = new StateManager({ trie: trie })
  vm = new VM({
    stateManager: stateManager,
    hardfork: options.forkConfig.toLowerCase()
  })
  if (options.jsontrace) {
    hookVM(vm, t)
  }
  try {
    await vm.runTx({ tx: tx, block: block })
  } catch (err) {
    await deleteCoinbase(stateManager, block.header.coinbase)
  }
  t.equal(stateManager._trie.root.toString('hex'), expectedPostStateRoot, 'the state roots should match')
}

/*
 * If tx is invalid and coinbase is empty, the test harness
 * expects the coinbase account to be deleted from state.
 * Without this ecmul_0-3_5616_28000_96 would fail.
 */
async function deleteCoinbase (stateManager, coinbaseAddr) {
  const account = await stateManager.getAccount(coinbaseAddr)
  if (new BN(account.balance).isZero()) {
    await stateManager.putAccount(coinbaseAddr, new Account())
    await stateManager.cleanupTouchedAccounts()
    await stateManager._wrapped._cache.flush()
  }
}

function hookVM (vm, t) {
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
      'stateRoot': vm.stateManager._trie.root.toString('hex')
    }
    t.comment(JSON.stringify(stateRoot))
  })
}

function parseTestCases (forkConfig, testData, data, gasLimit, value) {
  let testCases = []
  if (testData['post'][forkConfig]) {
    testCases = testData['post'][forkConfig].map(testCase => {
      let testIndexes = testCase['indexes']
      let tx = { ...testData.transaction }
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

module.exports = async function runStateTest (options, testData, t) {
  const forkConfig = getRequiredForkConfigAlias(options.forkConfigTestSuite)
  try {
    const testCases = parseTestCases(forkConfig, testData, options.data, options.gasLimit, options.value)
    if (testCases.length > 0) {
      for (const testCase of testCases) {
        await runTestCase(options, testCase, t)
      }
    } else {
      t.comment(`No ${forkConfig} post state defined, skip test`)
      return
    }
  } catch (e) {
    t.fail('error running test case for fork: ' + forkConfig)
    console.log('error:', e)
  }
}
