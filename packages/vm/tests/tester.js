#!/usr/bin/env node

const argv = require('minimist')(process.argv.slice(2))
const tape = require('tape')
const config = require('./config')
const testLoader = require('./testLoader')
const Common = require('@ethereumjs/common').default

function runTests() {
  let name
  if (argv.state) {
    name = 'GeneralStateTests'
  } else if (argv.blockchain) {
    name = 'BlockchainTests'
  } else if (argv.stateless) {
    name = 'Stateless'
  }

  const FORK_CONFIG = (argv.fork || config.DEFAULT_FORK_CONFIG)
  const FORK_CONFIG_TEST_SUITE = config.getRequiredForkConfigAlias(FORK_CONFIG)
  // Examples: Istanbul -> istanbul, MuirGlacier -> muirGlacier
  const FORK_CONFIG_VM = FORK_CONFIG.charAt(0).toLowerCase() + FORK_CONFIG.substring(1)

  /**
   * Configuration for getting the tests from the ethereum/tests repository
   */
  let testGetterArgs = {}
  testGetterArgs.skipTests = config.getSkipTests(argv.skip, argv.runSkipped ? 'NONE' : 'ALL')
  testGetterArgs.runSkipped = config.getSkipTests(argv.runSkipped, 'NONE')
  testGetterArgs.forkConfig = FORK_CONFIG_TEST_SUITE
  testGetterArgs.file = argv.file
  testGetterArgs.test = argv.test
  testGetterArgs.dir = argv.dir
  testGetterArgs.excludeDir = argv.excludeDir
  testGetterArgs.testsPath = argv.testsPath
  testGetterArgs.customStateTest = argv.customStateTest

  /**
   * Run-time configuration
   */
  let runnerArgs = {}
  runnerArgs.forkConfigVM = FORK_CONFIG_VM
  runnerArgs.forkConfigTestSuite = FORK_CONFIG_TEST_SUITE
  runnerArgs.jsontrace = argv.jsontrace
  runnerArgs.dist = argv.dist
  runnerArgs.data = argv.data // GeneralStateTests
  runnerArgs.gasLimit = argv.gas // GeneralStateTests
  runnerArgs.value = argv.value // GeneralStateTests
  runnerArgs.debug = argv.debug // BlockchainTests

  /**
   * Initialization output to console
   */
  const width = 50
  const fillWidth = width
  const fillParam = 20
  const delimiter = `| `.padEnd(fillWidth) + ' |'
  const formatArgs = (args) => {
    return Object.assign({}, ...
      Object.entries(args)
      .filter(([k,v]) => v && v.length !== 0)
      .map(([k,v]) => ({[k]:typeof(v) !== 'string' && v.length ? v.length : v}))
    )
  }
  const formattedGetterArgs = formatArgs(testGetterArgs)
  const formattedRunnerArgs = formatArgs(runnerArgs)
  
  console.log(`+${'-'.repeat(width)}+`)
  console.log(`| VM -> ${name} `.padEnd(fillWidth) + ' |')
  console.log(delimiter)
  console.log(`| TestGetterArgs`.padEnd(fillWidth) + ' |')
  for (const [key, value] of Object.entries(formattedGetterArgs)) {
    console.log(`| ${key.padEnd(fillParam)}: ${value}`.padEnd(fillWidth) + ' |')
  }
  console.log(delimiter)
  console.log(`| RunnerArgs`.padEnd(fillWidth) + ' |')
  for (const [key, value] of Object.entries(formattedRunnerArgs)) {
    console.log(`| ${key.padEnd(fillParam)}: ${value}`.padEnd(fillWidth) + ' |')
  }
  console.log(`+${'-'.repeat(width)}+`)
  console.log()

  // Run a custom state test
  if (argv.customStateTest) {
    const stateTestRunner = require('./GeneralStateTestsRunner.js')
    let fileName = argv.customStateTest
    tape(name, t => {
      testLoader.getTestFromSource(fileName, async (err, test) => {
        if (err) {
          return t.fail(err)
        }
        t.comment(`file: ${fileName} test: ${test.testName}`)
        await stateTestRunner(runnerArgs, test, t)
        t.end()
      })
    })
  // Stateless test execution
  } else if (name === 'Stateless') {
    tape(name, t => {
      const stateTestRunner = require('./StatelessRunner.js')
      let count = 0
      testLoader.getTestsFromArgs('GeneralStateTests', async (fileName, testName, test) => {
        let runSkipped = testGetterArgs.runSkipped
        let inRunSkipped = runSkipped.includes(fileName)
        if (runSkipped.length === 0 || inRunSkipped) {
          count += 1
          if (count < 2) {
            t.comment(`file: ${fileName} test: ${testName}`)
            return stateTestRunner(runnerArgs, test, t)
          }
        }
      }, testGetterArgs).then(() => {
        t.end()
      }).catch((err) => {
        console.log(err)
        t.end()
      })
    })
  // Blockchain and State Tests
  } else {
    tape(name, t => {
      const runner = require(`./${name}Runner.js`)
      // Tests for HFs before Istanbul have been moved under `LegacyTests/Constantinople`:
      // https://github.com/ethereum/tests/releases/tag/v7.0.0-beta.1

      const common = new Common('mainnet', FORK_CONFIG_VM)
      if (!common.gteHardfork('istanbul')) {
        name = 'LegacyTests/Constantinople/'.concat(name)
      }
      testLoader.getTestsFromArgs(
        name,
        async (fileName, testName, test) => {
          let runSkipped = testGetterArgs.runSkipped
          let inRunSkipped = runSkipped.includes(fileName)
          if (runSkipped.length === 0 || inRunSkipped) {
            t.comment(`file: ${fileName} test: ${testName}`)
            await runner(runnerArgs, test, t)
          }
        },
        testGetterArgs,
      )
      .then(() => {
        t.end()
      })
      .catch((error) => {
        t.comment(error)
      })
    })
  }
}

runTests()
