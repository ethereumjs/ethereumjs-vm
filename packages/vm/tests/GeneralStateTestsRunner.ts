import * as tape from 'tape'
import { SecureTrie as Trie } from 'merkle-patricia-tree'
import { Account, BN, toBuffer } from 'ethereumjs-util'
import Common from '@ethereumjs/common'
import { setupPreConditions, makeTx, makeBlockFromEnv } from './util'
import { InterpreterStep } from '../lib/evm/interpreter'

function parseTestCases(
  forkConfigTestSuite: string,
  testData: any,
  data: string | undefined,
  gasLimit: string | undefined,
  value: string | undefined
) {
  let testCases = []

  if (testData['post'][forkConfigTestSuite]) {
    testCases = testData['post'][forkConfigTestSuite].map((testCase: any) => {
      const testIndexes = testCase['indexes']
      const tx = { ...testData.transaction }
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

      if (tx.accessLists) {
        tx.accessList = testData.transaction.accessLists[testIndexes['data']]
        if (tx.chainId == undefined) {
          tx.chainId = 1
        }
      }

      return {
        transaction: tx,
        postStateRoot: testCase['hash'],
        env: testData['env'],
        pre: testData['pre'],
      }
    })
  }

  testCases = testCases.filter((testCase: any) => {
    return testCase != null
  })

  return testCases
}

async function runTestCase(options: any, testData: any, t: tape.Test) {
  let VM
  if (options.dist) {
    VM = require('../dist').default
  } else {
    VM = require('../lib').default
  }

  const state = new Trie()
  const hardfork = options.forkConfigVM

  const eips: number[] = []

  const common = new Common({ chain: 'mainnet', hardfork, eips })

  const vm = await VM.create({ state, common })

  await setupPreConditions(vm.stateManager._trie, testData)

  const tx = makeTx(testData.transaction, { common })

  if (!tx.validate()) {
    throw new Error('Transaction is invalid')
  }

  const block = makeBlockFromEnv(testData.env, { common })

  if (options.jsontrace) {
    vm.on('step', function (e: InterpreterStep) {
      let hexStack = []
      hexStack = e.stack.map((item: any) => {
        return '0x' + new BN(item).toString(16, 0)
      })

      const opTrace = {
        pc: e.pc,
        op: e.opcode.name,
        gas: '0x' + e.gasLeft.toString('hex'),
        gasCost: '0x' + e.opcode.fee.toString(16),
        stack: hexStack,
        depth: e.depth,
        opName: e.opcode.name,
      }

      t.comment(JSON.stringify(opTrace))
    })
    vm.on('afterTx', async () => {
      const stateRoot = {
        stateRoot: vm.stateManager._trie.root.toString('hex'),
      }
      t.comment(JSON.stringify(stateRoot))
    })
  }

  try {
    await vm.runTx({ tx, block })
  } catch (e) {
    // If tx is invalid and coinbase is empty, the test harness
    // expects the coinbase account to be deleted from state.
    // Without this ecmul_0-3_5616_28000_96 would fail.
    const account = await vm.stateManager.getAccount(block.header.coinbase)
    if (account.balance.isZero()) {
      await vm.stateManager.putAccount(block.header.coinbase, new Account())
      await vm.stateManager.cleanupTouchedAccounts()
      await vm.stateManager._cache.flush()
    }
  }

  const stateManagerStateRoot = vm.stateManager._trie.root
  const testDataPostStateRoot = toBuffer(testData.postStateRoot)

  t.ok(stateManagerStateRoot.equals(testDataPostStateRoot), 'the state roots should match')
}

export default async function runStateTest(options: any, testData: any, t: tape.Test) {
  try {
    const testCases = parseTestCases(
      options.forkConfigTestSuite,
      testData,
      options.data,
      options.gasLimit,
      options.value
    )
    if (testCases.length === 0) {
      t.comment(`No ${options.forkConfigTestSuite} post state defined, skip test`)
      return
    }
    for (const testCase of testCases) {
      await runTestCase(options, testCase, t)
    }
  } catch (e) {
    console.log(e)
    t.fail('error running test case for fork: ' + <string>options.forkConfigTestSuite)
  }
}
