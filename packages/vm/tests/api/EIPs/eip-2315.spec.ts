import tape from 'tape'
import { BN } from 'ethereumjs-util'
import VM from '../../../lib'
import Common from '@ethereumjs/common'

tape('Berlin: EIP 2315 tests', (t) => {
  const common = new Common({ chain: 'mainnet', hardfork: 'berlin', eips: [2315] })

  const runTest = async function (test: any, st: tape.Test) {
    let i = 0
    const vm = await VM.create({ common })

    vm.on('step', function (step: any) {
      if (test.steps.length) {
        st.equal(step.pc, test.steps[i].expectedPC)
        st.equal(step.opcode.name, test.steps[i].expectedOpcode)
      }
      i++
    })

    const result = await vm.runCode({
      code: Buffer.from(test.code, 'hex'),
      gasLimit: new BN(0xffffffffff),
    })

    st.equal(i, test.totalSteps)
    return result
  }

  // EIP test case 1
  t.test('should jump into a subroutine, back out and stop', async (st) => {
    const test = {
      code: '60045e005c5d',
      totalSteps: 4,
      steps: [
        { expectedPC: 0, expectedOpcode: 'PUSH1' },
        { expectedPC: 2, expectedOpcode: 'JUMPSUB' },
        { expectedPC: 5, expectedOpcode: 'RETURNSUB' },
        { expectedPC: 3, expectedOpcode: 'STOP' },
      ],
    }

    const result = await runTest(test, st)
    st.equal(undefined, result.exceptionError)
    st.end()
  })

  // EIP test case 2
  t.test('should go into two depths of subroutines', async (st) => {
    const test = {
      code: '6800000000000000000c5e005c60115e5d5c5d',
      totalSteps: 7,
      steps: [
        { expectedPC: 0, expectedOpcode: 'PUSH9' },
        { expectedPC: 10, expectedOpcode: 'JUMPSUB' },
        { expectedPC: 13, expectedOpcode: 'PUSH1' },
        { expectedPC: 15, expectedOpcode: 'JUMPSUB' },
        { expectedPC: 18, expectedOpcode: 'RETURNSUB' },
        { expectedPC: 16, expectedOpcode: 'RETURNSUB' },
        { expectedPC: 11, expectedOpcode: 'STOP' },
      ],
    }

    const result = await runTest(test, st)
    st.equal(undefined, result.exceptionError)
    st.end()
  })

  // EIP test case 3
  t.test('should error on invalid jumpsub (location out of code range)', async (st) => {
    const test = {
      code: '6801000000000000000c5e005c60115e5d5c5d',
      totalSteps: 2,
      steps: [
        { expectedPC: 0, expectedOpcode: 'PUSH9' },
        { expectedPC: 10, expectedOpcode: 'JUMPSUB' },
      ],
    }

    const result = await runTest(test, st)
    st.equal(true, result.exceptionError?.error.includes('invalid JUMPSUB at'))
    st.end()
  })

  // hyperledger/besu PR 717 test case
  // https://github.com/hyperledger/besu/pull/717/files#diff-5d1330bc567b68d81941896ef2d2ce88R114
  t.test('should error on invalid jumpsub (dest not BEGINSUB)', async (st) => {
    const test = {
      code: '60055e005c5d',
      totalSteps: 2,
      steps: [
        { expectedPC: 0, expectedOpcode: 'PUSH1' },
        { expectedPC: 2, expectedOpcode: 'JUMPSUB' },
      ],
    }

    const result = await runTest(test, st)
    st.equal(true, result.exceptionError?.error.includes('invalid JUMPSUB at'))
    st.end()
  })

  // Code is same as EIP example 1 above, with JUMP substituted for JUMPSUB
  t.test('BEGINSUB should not be a valid dest for JUMP', async (st) => {
    const test = {
      code: '600456005c5d',
      totalSteps: 2,
      steps: [
        { expectedPC: 0, expectedOpcode: 'PUSH1' },
        { expectedPC: 2, expectedOpcode: 'JUMP' },
      ],
    }

    const result = await runTest(test, st)
    st.equal(true, result.exceptionError?.error.includes('invalid JUMP at'))
    st.end()
  })

  // EIP test case 4
  t.test('should error when the return stack is too shallow', async (st) => {
    const test = {
      code: '5d5858',
      totalSteps: 1,
      steps: [{ expectedPC: 0, expectedOpcode: 'RETURNSUB' }],
    }

    const result = await runTest(test, st)
    st.equal(true, result.exceptionError?.error.includes('invalid RETURNSUB'))
    st.end()
  })

  // EIP test case 5
  // Note: this case differs slightly from the EIP spec which expects STOP as the last step.
  t.test(
    'it should hit the `virtual stop` when JUMP is on the last byte of code (EIP)',
    async (st) => {
      const test = {
        code: '6005565c5d5b60035e',
        totalSteps: 6,
        steps: [
          { expectedPC: 0, expectedOpcode: 'PUSH1' },
          { expectedPC: 2, expectedOpcode: 'JUMP' },
          { expectedPC: 5, expectedOpcode: 'JUMPDEST' },
          { expectedPC: 6, expectedOpcode: 'PUSH1' },
          { expectedPC: 8, expectedOpcode: 'JUMPSUB' },
          { expectedPC: 4, expectedOpcode: 'RETURNSUB' },
        ],
      }

      const result = await runTest(test, st)
      st.equal(undefined, result.exceptionError)
      st.end()
    }
  )

  // The code recursively calls itself. It should error when the returns-stack grows above 1023
  t.test('it should error if the return stack size limit (1023) is hit', async (st) => {
    const ops = [
      '60',
      '03', // PUSH1 3   # 1
      '5e', // JUMPSUB   # 2
      '5c', // BEGINSUB  # 3
      '60',
      '03', // PUSH1 3   # 4
      '5e', // JUMPSUB   # 5
    ]

    // Max return stack height is 1023
    // First return stack entry runs 4 ops (1, 2, 4, 5)
    // Next 1022 are a loop of 2 ops (4, 5)
    const expectedTotalSteps = 1022 * 2 + 4
    const test = {
      code: ops.join(''),
      totalSteps: expectedTotalSteps,
      steps: [],
    }

    const result = await runTest(test, st)
    st.equal(true, result.exceptionError?.error.includes('stack overflow'))
    st.end()
  })

  // EIP test case 6
  t.test('should error when walking into BEGINSUB', async (st) => {
    const test = {
      code: '5c',
      totalSteps: 1,
      steps: [{ expectedPC: 0, expectedOpcode: 'BEGINSUB' }],
    }

    const result = await runTest(test, st)
    st.equal(true, result.exceptionError?.error.includes('invalid BEGINSUB'))
    st.end()
  })
})
