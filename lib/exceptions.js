const ERROR = {
  OUT_OF_GAS: 'out of gas',
  STACK_UNDERFLOW: 'stack underflow',
  STACK_OVERFLOW: 'stack overflow',
  INVALID_JUMP: 'invalid JUMP',
  INVALID_OPCODE: 'invalid opcode',
  OUT_OF_RANGE: 'value out of range',
  REVERT: 'revert',
  STATIC_STATE_CHANGE: 'static state change',
  INTERNAL_ERROR: 'internal error'
}

function VmError (error) {
  this.error = error
  this.errorType = 'VmError'
}

/**
 * This exception is thrown when ewasm modules
 * call `finish`, to halt execution immediately.
 */
function FinishExecution (message) {
  this.message = message
  this.name = this.errorType = 'FinishExecution'
}

module.exports = {
  ERROR: ERROR,
  VmError: VmError,
  FinishExecution: FinishExecution
}
