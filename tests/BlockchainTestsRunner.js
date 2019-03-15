const async = require('async')
const testUtil = require('./util.js')
const ethUtil = require('ethereumjs-util')
const Trie = require('merkle-patricia-tree/secure')
const Block = require('ethereumjs-block')
const Blockchain = require('ethereumjs-blockchain')
const BlockHeader = require('ethereumjs-block/header.js')
const level = require('level')
const levelMem = require('level-mem')

var cacheDB = level('./.cachedb')
module.exports = function runBlockchainTest (options, testData, t, cb) {
  var blockchainDB = levelMem()
  var state = new Trie()
  var validate = false
  // Only run with block validation when sealEngine present in test file
  // and being set to Ethash PoW validation
  if (testData.sealEngine && testData.sealEngine === 'Ethash') {
    validate = true
  }
  var blockchain = new Blockchain({
    db: blockchainDB,
    hardfork: options.forkConfig.toLowerCase(),
    validate: validate
  })
  if (validate) {
    blockchain.ethash.cacheDB = cacheDB
  }
  var VM
  if (options.dist) {
    VM = require('../dist/index.js')
  } else {
    VM = require('../lib/index.js')
  }
  var vm = new VM({
    state: state,
    blockchain: blockchain,
    hardfork: options.forkConfig.toLowerCase(),
    enableEwasmPrecompiles: options.enableEwasmPrecompiles
  })
  var genesisBlock = new Block({ hardfork: options.forkConfig.toLowerCase() })

  testData.homestead = true
  if (testData.homestead) {
    vm.on('beforeTx', function (tx) {
      tx._homestead = true
    })
    vm.on('beforeBlock', function (block) {
      block.header.isHomestead = function () {
        return true
      }
    })
  }
  async.series([
    // set up pre-state
    function (done) {
      testUtil.setupPreConditions(state, testData, function () {
        done()
      })
    },
    function (done) {
      // create and add genesis block
      genesisBlock.header = new BlockHeader(formatBlockHeader(testData.genesisBlockHeader), {
        hardfork: options.forkConfig.toLowerCase()
      })
      t.equal(state.root.toString('hex'), genesisBlock.header.stateRoot.toString('hex'), 'correct pre stateRoot')
      if (testData.genesisRLP) {
        t.equal(genesisBlock.serialize().toString('hex'), testData.genesisRLP.slice(2), 'correct genesis RLP')
      }
      blockchain.putGenesis(genesisBlock, function (err) {
        done(err)
      })
    },
    function (done) {
      async.eachSeries(testData.blocks, function (raw, cb) {
        try {
          var block = new Block(Buffer.from(raw.rlp.slice(2), 'hex'), {
            hardfork: options.forkConfig.toLowerCase()
          })
          // forces the block into thinking they are homestead
          if (testData.homestead) {
            block.header.isHomestead = function () {
              return true
            }
            block.uncleHeaders.forEach(function (uncle) {
              uncle.isHomestead = function () {
                return true
              }
            })
          }
          blockchain.putBlock(block, function (err) {
            cb(err)
          })
        } catch (err) {
          if (err) {
            t.fail(err)
          }
          cb()
        }
      }, function () {
        done()
      })
    },
    function runBlockchain (done) {
      vm.runBlockchain(function () {
        done()
      })
    },
    function getHead (done) {
      vm.blockchain.getHead(function (err, block) {
        if (testData.lastblockhash.substr(0, 2) === '0x') {
          // fix for BlockchainTests/GeneralStateTests/stRandom/*
          testData.lastblockhash = testData.lastblockhash.substr(2)
        }
        t.equal(block.hash().toString('hex'), testData.lastblockhash, 'last block hash')
        // if the test fails, then block.header is the preState because
        // vm.runBlock has a check that prevents the actual postState from being
        // imported if it is not equal to the expected postState. it is useful
        // for debugging to skip this, so that verifyPostConditions will compare
        // testData.postState to the actual postState, rather than to the preState.
        if (!options.debug) {
          // make sure the state is set before checking post conditions
          state.root = block.header.stateRoot
        }
        done(err)
      })
    },
    function (done) {
      if (options.debug) {
        testUtil.verifyPostConditions(state, testData.postState, t, done)
      } else {
        done()
      }
    }
  ], function () {
    t.equal(blockchain.meta.rawHead.toString('hex'), testData.lastblockhash, 'correct header block')
    cb()
  })
}

function formatBlockHeader (data) {
  var r = {}
  var keys = Object.keys(data)
  keys.forEach(function (key) {
    r[key] = ethUtil.addHexPrefix(data[key])
  })
  return r
}
