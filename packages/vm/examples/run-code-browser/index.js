/*
 * Example - Running code on an ethereum-vm
 *
 *
 * To run this example in the browser, bundle this file
 * with browserify using `browserify index.js -o bundle.js`
 * and then load this folder onto a HTTP WebServer (e.g.
 * using node-static or `python -mSimpleHTTPServer`).
 */
const BN = require('bn.js')
const VM = require('../../dist.browser').default

const run = async () => {
  // Create a new VM instance
  // To explicity set the chain or hardfork use [Common](https://github.com/ethereumjs/ethereumjs-monorepo/tree/master/packages/common#usage)
  const vm = await VM.create()

  const STOP = '00'
  const ADD = '01'
  const PUSH1 = '60'

  // Note that numbers added are hex values, so '20' would be '32' as decimal e.g.
  const code = [PUSH1, '03', PUSH1, '05', ADD, STOP]

  vm.on('step', function (data) {
    console.log(`Opcode: ${data.opcode.name}\tStack: ${data.stack}`)
  })

  vm.runCode({
    code: Buffer.from(code.join(''), 'hex'),
    gasLimit: new BN(0xffff),
  })
    .then((results) => {
      console.log(`Returned: ${results.returnValue.toString('hex')}`)
      console.log(`gasUsed : ${results.gasUsed.toString()}`)
    })
    .catch(console.error)
}

run()
