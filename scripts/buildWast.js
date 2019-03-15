const assert = require('assert')
const fs = require('fs')
const path = require('path')
const argv = require('yargs').argv
const wabt = require('wabt')()

assert(argv._.length === 1, 'Expected one wast input file')

let wastFile = argv._[0]
let outPath = argv.o
if (!outPath) {
  outPath = wastFile.replace('.wast', '.wasm')
}

const wastRaw = fs.readFileSync(wastFile).toString()
const mod = wabt.parseWat(path.basename(wastFile), wastRaw)
const wasmRaw = mod.toBinary({ log: false })

fs.writeFileSync(outPath, wasmRaw.buffer)
