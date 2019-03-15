const assert = require('assert')
const Env = require('./env')
const Memory = require('./memory')

/**
 * Represents an ewasm module. It instantiates the module
 * on `run`, and expects `main` and `memory` to be exported.
 * A limited subset of EEI is provided to be imported by
 * the module.
 */
module.exports = class Contract {
  /**
   * @param {BufferSource} code - WASM binary code
   */
  constructor (code) {
    this._module = new WebAssembly.Module(code)
  }

  /**
   * Instantiates the module, providing a subset of EEI as
   * imports, and then executes the exported `main` function.
   * @param {Object} opts - Environment data required for the call
   * @returns result of execution as an Object.
   */
  run (opts) {
    const env = new Env(opts)

    this._instance = new WebAssembly.Instance(this._module, env.imports)

    assert(this._instance.exports.main, 'Wasm module has no main function')
    assert(this._instance.exports.memory, 'Wasm module has no memory exported')

    this._memory = new Memory(this._instance.exports.memory)
    env.setMemory(this._memory)

    // Run contract. It throws even on successful finish.
    try {
      this._instance.exports.main()
    } catch (e) {
      if (e.errorType !== 'VmError' && e.errorType !== 'FinishExecution') {
        throw e
      }
    }

    return env._results
  }
}
