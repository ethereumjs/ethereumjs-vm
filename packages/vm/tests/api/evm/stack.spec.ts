import tape from 'tape'
import { Address, BN } from 'ethereumjs-util'
import VM from '../../../lib'
import Stack from '../../../lib/evm/stack'
import { createAccount } from '../utils'

tape('Stack', (t) => {
  t.test('should be empty initially', (st) => {
    const s = new Stack()
    st.equal(s._store.length, 0)
    st.throws(() => s.pop())
    st.end()
  })

  t.test('popN should throw for empty stack', (st) => {
    const s = new Stack()
    st.deepEqual(s.popN(0), [])
    st.throws(() => s.popN(1))
    st.end()
  })

  t.test('should not push invalid type values', (st) => {
    const s = new Stack()
    st.throws(() => s.push(<any>'str'))
    st.throws(() => s.push(<any>5))
    st.end()
  })

  t.test('should push item', (st) => {
    const s = new Stack()
    s.push(new BN(5))
    st.equal(s.pop().toNumber(), 5)
    st.end()
  })

  t.test('popN should return array for n = 1', (st) => {
    const s = new Stack()
    s.push(new BN(5))
    st.deepEqual(s.popN(1), [new BN(5)])
    st.end()
  })

  t.test('popN should fail on underflow', (st) => {
    const s = new Stack()
    s.push(new BN(5))
    st.throws(() => s.popN(2))
    st.end()
  })

  t.test('popN should return in correct order', (st) => {
    const s = new Stack()
    s.push(new BN(5))
    s.push(new BN(7))
    st.deepEqual(s.popN(2), [new BN(7), new BN(5)])
    st.end()
  })

  t.test('should throw on overflow', (st) => {
    const s = new Stack()
    for (let i = 0; i < 1024; i++) {
      s.push(new BN(i))
    }
    st.throws(() => s.push(new BN(1024)))
    st.end()
  })

  t.test('overflow limit should be configurable', (st) => {
    const s = new Stack(1023)
    for (let i = 0; i < 1023; i++) {
      s.push(new BN(i))
    }
    st.throws(() => s.push(new BN(1023)))
    st.end()
  })

  t.test('should swap top with itself', (st) => {
    const s = new Stack()
    s.push(new BN(5))
    s.swap(0)
    st.deepEqual(s.pop(), new BN(5))
    st.end()
  })

  t.test('swap should throw on underflow', (st) => {
    const s = new Stack()
    s.push(new BN(5))
    st.throws(() => s.swap(1))
    st.end()
  })

  t.test('should swap', (st) => {
    const s = new Stack()
    s.push(new BN(5))
    s.push(new BN(7))
    s.swap(1)
    st.deepEqual(s.pop(), new BN(5))
    st.end()
  })

  t.test('dup should throw on underflow', (st) => {
    const s = new Stack()
    st.throws(() => s.dup(1))
    s.push(new BN(5))
    st.throws(() => s.dup(2))
    st.end()
  })

  t.test('should dup', (st) => {
    const s = new Stack()
    s.push(new BN(5))
    s.push(new BN(7))
    s.dup(2)
    st.deepEqual(s.pop(), new BN(5))
    st.end()
  })

  t.test('should validate value overflow', (st) => {
    const s = new Stack()
    const max = new BN(2).pow(new BN(256)).subn(1)
    s.push(max)
    st.deepEqual(s.pop(), max)
    st.throws(() => s.push(max.addn(1)))
    st.end()
  })

  t.test('stack items should not change if they are DUPed', async (st) => {
    const caller = new Address(Buffer.from('00000000000000000000000000000000000000ee', 'hex'))
    const addr = new Address(Buffer.from('00000000000000000000000000000000000000ff', 'hex'))
    const vm = await VM.create()
    const account = createAccount(new BN(0), new BN(0))
    const code = '60008080808060013382F15060005260206000F3'
    const expectedReturnValue = new BN(0).toArrayLike(Buffer, 'be', 32)
    /*
      code:             remarks: (top of the stack is at the zero index)
          PUSH1 0x00
          DUP1
          DUP1
          DUP1
          DUP1
          PUSH1 0x01
          CALLER
          DUP3
          CALL          stack: [0, CALLER, 1, 0, 0, 0, 0, 0]
          POP           pop the call result (1)
          PUSH1 0x00
          MSTORE        we now expect that the stack (prior to MSTORE) is [0, 0]
          PUSH1 0x20
          PUSH1 0x00
          RETURN        stack: [0, 0x20] (we thus return the stack item which was originally pushed as 0, and then DUPed)
    */
    await vm.stateManager.putAccount(addr, account)
    await vm.stateManager.putContractCode(addr, Buffer.from(code, 'hex'))
    const runCallArgs = {
      caller: caller,
      gasLimit: new BN(0xffffffffff),
      to: addr,
      value: new BN(1),
    }
    try {
      const res = await vm.runCall(runCallArgs)
      const executionReturnValue = res.execResult.returnValue
      st.assert(executionReturnValue.equals(expectedReturnValue))
      st.end()
    } catch (e) {
      st.fail(e.message)
    }
  })
})
