import tape from 'tape'
import {
  Account,
  Address,
  BN,
  toBuffer,
  keccak256,
  KECCAK256_RLP,
  KECCAK256_RLP_S,
  unpadBuffer,
  zeros,
} from 'ethereumjs-util'
import Common from '@ethereumjs/common'
import { DefaultStateManager } from '../../../lib/state'
import { createAccount } from '../utils'
import { isRunningInKarma } from '../../util'
const testLoader = require('../../testLoader')

const StateManager = DefaultStateManager

tape('StateManager', (t) => {
  t.test('should instantiate', async (st) => {
    const stateManager = new DefaultStateManager()

    st.deepEqual(stateManager._trie.root, KECCAK256_RLP, 'it has default root')
    st.equal(stateManager._common.hardfork(), 'petersburg', 'it has default hardfork')
    const res = await stateManager.getStateRoot()
    st.deepEqual(res, KECCAK256_RLP, 'it has default root')
    st.end()
  })

  t.test('should set the state root to empty', async (st) => {
    const stateManager = new DefaultStateManager()
    st.ok(stateManager._trie.root.equals(KECCAK256_RLP), 'it has default root')

    // commit some data to the trie
    const address = new Address(Buffer.from('a94f5374fce5edbc8e2a8697c15331677e6ebf0b', 'hex'))
    const account = createAccount(new BN(0), new BN(1000))
    await stateManager.checkpoint()
    await stateManager.putAccount(address, account)
    await stateManager.commit()
    st.ok(!stateManager._trie.root.equals(KECCAK256_RLP), 'it has a new root')

    // set state root to empty trie root
    const emptyTrieRoot = Buffer.from(KECCAK256_RLP_S, 'hex')
    await stateManager.setStateRoot(emptyTrieRoot)

    const res = await stateManager.getStateRoot()
    st.ok(res.equals(KECCAK256_RLP), 'it has default root')
    st.end()
  })

  t.test('should clear the cache when the state root is set', async (st) => {
    const stateManager = new DefaultStateManager()
    const address = new Address(Buffer.from('a94f5374fce5edbc8e2a8697c15331677e6ebf0b', 'hex'))
    const account = createAccount()

    // test account storage cache
    const initialStateRoot = await stateManager.getStateRoot()
    await stateManager.checkpoint()
    await stateManager.putAccount(address, account)

    const account0 = await stateManager.getAccount(address)
    st.ok(account0.balance.eq(account.balance), 'account value is set in the cache')

    await stateManager.commit()
    const account1 = await stateManager.getAccount(address)
    st.ok(account1.balance.eq(account.balance), 'account value is set in the state trie')

    await stateManager.setStateRoot(initialStateRoot)
    const account2 = await stateManager.getAccount(address)
    st.ok(account2.balance.isZero(), 'account value is set to 0 in original state root')

    // test contract storage cache
    await stateManager.checkpoint()
    const key = toBuffer('0x1234567890123456789012345678901234567890123456789012345678901234')
    const value = Buffer.from('0x1234')
    await stateManager.putContractStorage(address, key, value)

    const contract0 = await stateManager.getContractStorage(address, key)
    st.ok(contract0.equals(value), "contract key's value is set in the _storageTries cache")

    await stateManager.commit()
    await stateManager.setStateRoot(initialStateRoot)
    const contract1 = await stateManager.getContractStorage(address, key)
    st.equal(contract1.length, 0, "contract key's value is unset in the _storageTries cache")

    st.end()
  })

  t.test(
    'should put and get account, and add to the underlying cache if the account is not found',
    async (st) => {
      const stateManager = new DefaultStateManager()
      const account = createAccount()
      const address = new Address(Buffer.from('a94f5374fce5edbc8e2a8697c15331677e6ebf0b', 'hex'))

      await stateManager.putAccount(address, account)

      const res1 = await stateManager.getAccount(address)

      st.equal(res1.balance.toString('hex'), 'fff384')

      await stateManager._cache.flush()
      stateManager._cache.clear()

      const res2 = await stateManager.getAccount(address)

      st.equal(stateManager._cache._cache.keys[0], address.buf.toString('hex'))
      st.ok(res1.serialize().equals(res2.serialize()))

      st.end()
    }
  )

  t.test(
    'should call the callback with a boolean representing emptiness, when the account is empty',
    async (st) => {
      const stateManager = new DefaultStateManager()
      const address = new Address(Buffer.from('a94f5374fce5edbc8e2a8697c15331677e6ebf0b', 'hex'))

      const res = await stateManager.accountIsEmpty(address)

      st.ok(res)

      st.end()
    }
  )

  t.test('should return false for a non-existent account', async (st) => {
    const stateManager = new DefaultStateManager()
    const address = new Address(Buffer.from('a94f5374fce5edbc8e2a8697c15331677e6ebf0b', 'hex'))

    const res = await stateManager.accountExists(address)

    st.notOk(res)

    st.end()
  })

  t.test('should return true for an existent account', async (st) => {
    const stateManager = new DefaultStateManager()
    const account = createAccount(new BN(0x1), new BN(0x1))
    const address = new Address(Buffer.from('a94f5374fce5edbc8e2a8697c15331677e6ebf0b', 'hex'))

    await stateManager.putAccount(address, account)

    const res = await stateManager.accountExists(address)

    st.ok(res)

    st.end()
  })

  t.test(
    'should call the callback with a false boolean representing non-emptiness when the account is not empty',
    async (st) => {
      const stateManager = new DefaultStateManager()
      const account = createAccount(new BN(0x1), new BN(0x1))
      const address = new Address(Buffer.from('a94f5374fce5edbc8e2a8697c15331677e6ebf0b', 'hex'))

      await stateManager.putAccount(address, account)

      const res = await stateManager.accountIsEmpty(address)

      st.notOk(res)

      st.end()
    }
  )
  t.test(
    'should generate the genesis state root correctly for mainnet from ethereum/tests data',
    async (st) => {
      if (isRunningInKarma()) {
        st.skip('skip slow test when running in karma')
        return st.end()
      }
      const genesisData = testLoader.getSingleFile('BasicTests/genesishashestest.json')

      const stateManager = new StateManager()
      await stateManager.generateCanonicalGenesis()
      const stateRoot = await stateManager.getStateRoot()
      st.equals(
        stateRoot.toString('hex'),
        genesisData.genesis_state_root,
        'generateCanonicalGenesis should produce correct state root for mainnet from ethereum/tests data'
      )
      st.end()
    }
  )

  t.test('should generate the genesis state root correctly for mainnet from common', async (st) => {
    if (isRunningInKarma()) {
      st.skip('skip slow test when running in karma')
      return st.end()
    }
    const common = new Common({ chain: 'mainnet', hardfork: 'petersburg' })
    const expectedStateRoot = Buffer.from(common.genesis().stateRoot.slice(2), 'hex')
    const stateManager = new StateManager({ common: common })

    await stateManager.generateCanonicalGenesis()
    const stateRoot = await stateManager.getStateRoot()

    st.true(
      stateRoot.equals(expectedStateRoot),
      `generateCanonicalGenesis should produce correct state root for mainnet from common`
    )
    st.end()
  })

  t.test('should generate the genesis state root correctly for all other chains', async (st) => {
    const chains = ['ropsten', 'rinkeby', 'kovan', 'goerli']

    for (const chain of chains) {
      const common = new Common({ chain: chain, hardfork: 'petersburg' })
      const expectedStateRoot = Buffer.from(common.genesis().stateRoot.slice(2), 'hex')
      const stateManager = new DefaultStateManager({ common: common })

      await stateManager.generateCanonicalGenesis()
      const stateRoot = await stateManager.getStateRoot()

      st.true(
        stateRoot.equals(expectedStateRoot),
        `generateCanonicalGenesis should produce correct state root for ${chain}`
      )
    }
    st.end()
  })

  t.test('should dump storage', async (st) => {
    const stateManager = new DefaultStateManager()
    const address = new Address(Buffer.from('a94f5374fce5edbc8e2a8697c15331677e6ebf0b', 'hex'))
    const account = createAccount()

    await stateManager.putAccount(address, account)

    const key = toBuffer('0x1234567890123456789012345678901234567890123456789012345678901234')
    const value = toBuffer('0x0a') // We used this value as its RLP encoding is also 0a
    await stateManager.putContractStorage(address, key, value)

    const data = await stateManager.dumpStorage(address)
    const expect = { [keccak256(key).toString('hex')]: '0a' }
    st.deepEqual(data, expect, 'should dump storage value')

    st.end()
  })

  t.test('should pass Common object when copying the state manager', (st) => {
    const stateManager = new DefaultStateManager({
      common: new Common({ chain: 'goerli', hardfork: 'byzantium' }),
    })

    st.equal(stateManager._common.chainName(), 'goerli')
    st.equal(stateManager._common.hardfork(), 'byzantium')

    const stateManagerCopy = stateManager.copy()
    st.equal((<any>stateManagerCopy)._common.chainName(), 'goerli')
    st.equal((<any>stateManagerCopy)._common.hardfork(), 'byzantium')

    st.end()
  })

  t.test("should validate the key's length when modifying a contract's storage", async (st) => {
    const stateManager = new DefaultStateManager()
    const address = new Address(Buffer.from('a94f5374fce5edbc8e2a8697c15331677e6ebf0b', 'hex'))
    try {
      await stateManager.putContractStorage(address, Buffer.alloc(12), toBuffer('0x1231'))
    } catch (e) {
      st.equal(e.message, 'Storage key must be 32 bytes long')
      st.end()
      return
    }

    st.fail('Should have failed')
    st.end()
  })

  t.test("should validate the key's length when reading a contract's storage", async (st) => {
    const stateManager = new DefaultStateManager()
    const address = new Address(Buffer.from('a94f5374fce5edbc8e2a8697c15331677e6ebf0b', 'hex'))
    try {
      await stateManager.getContractStorage(address, Buffer.alloc(12))
    } catch (e) {
      st.equal(e.message, 'Storage key must be 32 bytes long')
      st.end()
      return
    }

    st.fail('Should have failed')
    st.end()
  })
})

tape('Original storage cache', async (t) => {
  const stateManager = new DefaultStateManager()

  const address = new Address(Buffer.from('a94f5374fce5edbc8e2a8697c15331677e6ebf0b', 'hex'))
  const account = createAccount()
  await stateManager.putAccount(address, account)

  const key = Buffer.from('1234567890123456789012345678901234567890123456789012345678901234', 'hex')
  const value = Buffer.from('1234', 'hex')

  t.test('should initially have empty storage value', async (st) => {
    await stateManager.checkpoint()
    const res = await stateManager.getContractStorage(address, key)
    st.deepEqual(res, Buffer.alloc(0))

    const origRes = await stateManager.getOriginalContractStorage(address, key)
    st.deepEqual(origRes, Buffer.alloc(0))

    await stateManager.commit()

    st.end()
  })

  t.test('should set original storage value', async (st) => {
    await stateManager.putContractStorage(address, key, value)
    const res = await stateManager.getContractStorage(address, key)
    st.deepEqual(res, value)

    st.end()
  })

  t.test('should get original storage value', async (st) => {
    const res = await stateManager.getOriginalContractStorage(address, key)
    st.deepEqual(res, value)
    st.end()
  })

  t.test('should return correct original value after modification', async (st) => {
    const newValue = Buffer.from('1235', 'hex')
    await stateManager.putContractStorage(address, key, newValue)
    const res = await stateManager.getContractStorage(address, key)
    st.deepEqual(res, newValue)

    const origRes = await stateManager.getOriginalContractStorage(address, key)
    st.deepEqual(origRes, value)
    st.end()
  })

  t.test('should cache keys separately', async (st) => {
    const key2 = Buffer.from(
      '0000000000000000000000000000000000000000000000000000000000000012',
      'hex'
    )
    const value2 = Buffer.from('12', 'hex')
    const value3 = Buffer.from('123', 'hex')
    await stateManager.putContractStorage(address, key2, value2)

    let res = await stateManager.getContractStorage(address, key2)
    st.deepEqual(res, value2)
    let origRes = await stateManager.getOriginalContractStorage(address, key2)
    st.deepEqual(origRes, value2)

    await stateManager.putContractStorage(address, key2, value3)

    res = await stateManager.getContractStorage(address, key2)
    st.deepEqual(res, value3)
    origRes = await stateManager.getOriginalContractStorage(address, key2)
    st.deepEqual(origRes, value2)

    // Check previous key
    res = await stateManager.getContractStorage(address, key)
    st.deepEqual(res, Buffer.from('1235', 'hex'))
    origRes = await stateManager.getOriginalContractStorage(address, key)
    st.deepEqual(origRes, value)

    st.end()
  })

  t.test("getOriginalContractStorage should validate the key's length", async (st) => {
    try {
      await stateManager.getOriginalContractStorage(address, Buffer.alloc(12))
    } catch (e) {
      st.equal(e.message, 'Storage key must be 32 bytes long')
      st.end()
      return
    }

    st.fail('Should have failed')
    st.end()
  })
})

tape('StateManager - Contract code', (tester) => {
  const it = tester.test

  it('should set and get code', async (t) => {
    const stateManager = new DefaultStateManager()
    const address = new Address(Buffer.from('a94f5374fce5edbc8e2a8697c15331677e6ebf0b', 'hex'))
    const code = Buffer.from(
      '73095e7baea6a6c7c4c2dfeb977efac326af552d873173095e7baea6a6c7c4c2dfeb977efac326af552d873157',
      'hex'
    )
    const raw = {
      nonce: '0x0',
      balance: '0x03e7',
      stateRoot: '0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421',
      codeHash: '0xb30fb32201fe0486606ad451e1a61e2ae1748343cd3d411ed992ffcc0774edd4',
    }
    const account = Account.fromAccountData(raw)
    await stateManager.putAccount(address, account)
    await stateManager.putContractCode(address, code)
    const codeRetrieved = await stateManager.getContractCode(address)
    t.ok(code.equals(codeRetrieved))
    t.end()
  })

  it('should not get code if is not contract', async (t) => {
    const stateManager = new DefaultStateManager()
    const address = new Address(Buffer.from('a94f5374fce5edbc8e2a8697c15331677e6ebf0b', 'hex'))
    const raw = {
      nonce: '0x0',
      balance: '0x03e7',
    }
    const account = Account.fromAccountData(raw)
    await stateManager.putAccount(address, account)
    const code = await stateManager.getContractCode(address)
    t.ok(code.equals(Buffer.alloc(0)))
    t.end()
  })

  it('should set empty code', async (t) => {
    const stateManager = new DefaultStateManager()
    const address = new Address(Buffer.from('a94f5374fce5edbc8e2a8697c15331677e6ebf0b', 'hex'))
    const raw = {
      nonce: '0x0',
      balance: '0x03e7',
    }
    const account = Account.fromAccountData(raw)
    const code = Buffer.alloc(0)
    await stateManager.putAccount(address, account)
    await stateManager.putContractCode(address, code)
    const codeRetrieved = await stateManager.getContractCode(address)
    t.ok(codeRetrieved.equals(Buffer.alloc(0)))
    t.end()
  })
})

tape('StateManager - Contract storage', (tester) => {
  const it = tester.test

  it('should throw on storage values larger than 32 bytes', async (t) => {
    t.plan(1)
    const stateManager = new DefaultStateManager()
    const address = Address.zero()
    const key = zeros(32)
    const value = Buffer.from('aa'.repeat(33), 'hex')
    try {
      await stateManager.putContractStorage(address, key, value)
      t.fail('did not throw')
    } catch (e) {
      t.pass('threw on trying to set storage values larger than 32 bytes')
    }
    t.end()
  })

  it('should strip zeros of storage values', async (t) => {
    const stateManager = new DefaultStateManager()
    const address = Address.zero()

    const key0 = zeros(32)
    const value0 = Buffer.from('00' + 'aa'.repeat(30), 'hex') // put a value of 31-bytes length with a leading zero byte
    const expect0 = unpadBuffer(value0)
    await stateManager.putContractStorage(address, key0, value0)
    const slot0 = await stateManager.getContractStorage(address, key0)
    t.ok(slot0.equals(expect0), 'value of 31 bytes padded correctly')

    const key1 = Buffer.concat([zeros(31), Buffer.from('01', 'hex')])
    const value1 = Buffer.from('0000' + 'aa'.repeat(1), 'hex') // put a value of 1-byte length with two leading zero bytes
    const expect1 = unpadBuffer(value1)
    await stateManager.putContractStorage(address, key1, value1)
    const slot1 = await stateManager.getContractStorage(address, key1)

    t.ok(slot1.equals(expect1), 'value of 1 byte padded correctly')
    t.end()
  })

  it('should delete storage values which only consist of zero bytes', async (t) => {
    const address = Address.zero()
    const key = zeros(32)
    const startValue = Buffer.from('01', 'hex')

    const zeroLengths = [0, 1, 31, 32] // checks for arbitrary-length zeros
    t.plan(zeroLengths.length)

    for (const length of zeroLengths) {
      const stateManager = new DefaultStateManager()
      const value = zeros(length)
      await stateManager.putContractStorage(address, key, startValue)
      const currentValue = await stateManager.getContractStorage(address, key)
      if (!currentValue.equals(startValue)) {
        // sanity check
        t.fail('contract value not set correctly')
      } else {
        // delete the value
        await stateManager.putContractStorage(address, key, value)
        const deleted = await stateManager.getContractStorage(address, key)
        t.ok(deleted.equals(zeros(0)), 'the storage key should be deleted')
      }
    }
    t.end()
  })

  it('should not strip trailing zeros', async (t) => {
    const address = Address.zero()
    const key = zeros(32)
    const value = Buffer.from('0000aabb00', 'hex')
    const expect = Buffer.from('aabb00', 'hex')
    const stateManager = new DefaultStateManager()
    await stateManager.putContractStorage(address, key, value)
    const contractValue = await stateManager.getContractStorage(address, key)
    t.ok(contractValue.equals(expect), 'trailing zeros are not stripped')
    t.end()
  })

  it('should get and verify EIP 1178 proofs', async (t) => {
    const address = Address.zero()
    const key = zeros(32)
    const value = Buffer.from('0000aabb00', 'hex')
    const code = Buffer.from('6000', 'hex')
    const stateManager = new DefaultStateManager()
    await stateManager.putContractStorage(address, key, value)
    await stateManager.putContractCode(address, code)
    const account = await stateManager.getAccount(address)
    account.balance = new BN(1)
    account.nonce = new BN(2)
    await stateManager.putAccount(address, account)

    const address2 = new Address(Buffer.from('20'.repeat(20), 'hex'))
    const account2 = await stateManager.getAccount(address2)
    account.nonce = new BN(2)
    await stateManager.putAccount(address2, account2)

    const proof = await stateManager.getProof(address, [key])
    console.log(proof)
    t.end()
  })
})

tape('StateManager - generateAccessList', (tester) => {
  const it = tester.test

  // Only use 0..9
  function a(n: number) {
    return Buffer.from(`ff${'00'.repeat(18)}0${n}`, 'hex')
  }

  // Only use 0..9
  function s(n: number) {
    return Buffer.from(`${'00'.repeat(31)}0${n}`, 'hex')
  }

  function getStateManagerAliases() {
    const stateManager = new DefaultStateManager()
    const addA = stateManager.addWarmedAddress.bind(stateManager)
    const addS = stateManager.addWarmedStorage.bind(stateManager)
    const gen = stateManager.generateAccessList.bind(stateManager)
    const sm = stateManager
    return { addA, addS, gen, sm }
  }

  it('one frame, simple', async (t) => {
    const { addA, addS, gen } = getStateManagerAliases()
    addA(a(1))
    addS(a(1), s(1))
    const json = [
      {
        address: '0xff00000000000000000000000000000000000001',
        storageKeys: ['0x0000000000000000000000000000000000000000000000000000000000000001'],
      },
    ]
    t.deepEqual(gen(), json)
    t.end()
  })

  it('one frame, unsorted slots', async (t) => {
    const { addA, addS, gen } = getStateManagerAliases()
    addA(a(1))
    addS(a(1), s(2))
    addS(a(1), s(1))
    const json = [
      {
        address: '0xff00000000000000000000000000000000000001',
        storageKeys: [
          '0x0000000000000000000000000000000000000000000000000000000000000001',
          '0x0000000000000000000000000000000000000000000000000000000000000002',
        ],
      },
    ]
    t.deepEqual(gen(), json)
    t.end()
  })

  it('one frame, unsorted addresses', async (t) => {
    const { addA, addS, gen } = getStateManagerAliases()
    addA(a(2))
    addS(a(2), s(1))
    addA(a(1))
    addS(a(1), s(1))
    const json = [
      {
        address: '0xff00000000000000000000000000000000000001',
        storageKeys: ['0x0000000000000000000000000000000000000000000000000000000000000001'],
      },
      {
        address: '0xff00000000000000000000000000000000000002',
        storageKeys: ['0x0000000000000000000000000000000000000000000000000000000000000001'],
      },
    ]
    t.deepEqual(gen(), json)
    t.end()
  })

  it('one frame, more complex', async (t) => {
    const { addA, addS, gen } = getStateManagerAliases()
    addA(a(1))
    addS(a(1), s(1))
    addA(a(2))
    addA(a(3))
    addS(a(3), s(1))
    addS(a(3), s(2))
    let json = [
      {
        address: '0xff00000000000000000000000000000000000001',
        storageKeys: ['0x0000000000000000000000000000000000000000000000000000000000000001'],
      },
      {
        address: '0xff00000000000000000000000000000000000002',
        storageKeys: [],
      },
      {
        address: '0xff00000000000000000000000000000000000003',
        storageKeys: [
          '0x0000000000000000000000000000000000000000000000000000000000000001',
          '0x0000000000000000000000000000000000000000000000000000000000000002',
        ],
      },
    ]
    t.deepEqual(gen(), json)

    json = [
      {
        address: '0xff00000000000000000000000000000000000002',
        storageKeys: [],
      },
      {
        address: '0xff00000000000000000000000000000000000003',
        storageKeys: [
          '0x0000000000000000000000000000000000000000000000000000000000000001',
          '0x0000000000000000000000000000000000000000000000000000000000000002',
        ],
      },
    ]
    const aRemoved = new Address(a(1))
    t.deepEqual(gen([aRemoved]), json, 'address removed')

    json = [
      {
        address: '0xff00000000000000000000000000000000000001',
        storageKeys: ['0x0000000000000000000000000000000000000000000000000000000000000001'],
      },
      {
        address: '0xff00000000000000000000000000000000000002',
        storageKeys: [],
      },
      {
        address: '0xff00000000000000000000000000000000000003',
        storageKeys: [
          '0x0000000000000000000000000000000000000000000000000000000000000001',
          '0x0000000000000000000000000000000000000000000000000000000000000002',
        ],
      },
    ]
    const aOnlyStorageKept = new Address(a(3))
    t.deepEqual(gen([], [aOnlyStorageKept]), json, 'addressesOnlyStorage, kept')

    json = [
      {
        address: '0xff00000000000000000000000000000000000001',
        storageKeys: ['0x0000000000000000000000000000000000000000000000000000000000000001'],
      },
      {
        address: '0xff00000000000000000000000000000000000003',
        storageKeys: [
          '0x0000000000000000000000000000000000000000000000000000000000000001',
          '0x0000000000000000000000000000000000000000000000000000000000000002',
        ],
      },
    ]
    const aOnlyStorageRemoved = new Address(a(2))
    t.deepEqual(gen([], [aOnlyStorageRemoved]), json, 'addressesOnlyStorage, removed')
    t.end()
  })

  it('two frames, simple', async (t) => {
    const { addA, addS, gen, sm } = getStateManagerAliases()
    addA(a(1))
    addS(a(1), s(1))
    await sm.checkpoint()
    addA(a(2))
    addA(a(3))
    addS(a(3), s(1))
    addS(a(3), s(2))
    const json = [
      {
        address: '0xff00000000000000000000000000000000000001',
        storageKeys: ['0x0000000000000000000000000000000000000000000000000000000000000001'],
      },
      {
        address: '0xff00000000000000000000000000000000000002',
        storageKeys: [],
      },
      {
        address: '0xff00000000000000000000000000000000000003',
        storageKeys: [
          '0x0000000000000000000000000000000000000000000000000000000000000001',
          '0x0000000000000000000000000000000000000000000000000000000000000002',
        ],
      },
    ]
    t.deepEqual(gen(), json)
    t.end()
  })

  it('two frames, same address with different storage slots', async (t) => {
    const { addA, addS, gen, sm } = getStateManagerAliases()
    addA(a(1))
    addS(a(1), s(1))
    await sm.checkpoint()
    addA(a(1))
    addS(a(1), s(2))
    const json = [
      {
        address: '0xff00000000000000000000000000000000000001',
        storageKeys: [
          '0x0000000000000000000000000000000000000000000000000000000000000001',
          '0x0000000000000000000000000000000000000000000000000000000000000002',
        ],
      },
    ]
    t.deepEqual(gen(), json)
    t.end()
  })

  it('two frames, same address with same storage slots', async (t) => {
    const { addA, addS, gen, sm } = getStateManagerAliases()
    addA(a(1))
    addS(a(1), s(1))
    await sm.checkpoint()
    addA(a(1))
    addS(a(1), s(1))
    const json = [
      {
        address: '0xff00000000000000000000000000000000000001',
        storageKeys: ['0x0000000000000000000000000000000000000000000000000000000000000001'],
      },
    ]
    t.deepEqual(gen(), json)
    t.end()
  })

  it('three frames, no accesses on level two', async (t) => {
    const { addA, addS, gen, sm } = getStateManagerAliases()
    addA(a(1))
    addS(a(1), s(1))
    await sm.checkpoint()
    await sm.checkpoint()
    addA(a(2))
    addS(a(2), s(2))
    const json = [
      {
        address: '0xff00000000000000000000000000000000000001',
        storageKeys: ['0x0000000000000000000000000000000000000000000000000000000000000001'],
      },
      {
        address: '0xff00000000000000000000000000000000000002',
        storageKeys: ['0x0000000000000000000000000000000000000000000000000000000000000002'],
      },
    ]
    t.deepEqual(gen(), json)
    t.end()
  })

  it('one frame, one revert frame', async (t) => {
    const { addA, addS, gen, sm } = getStateManagerAliases()
    await sm.checkpoint()
    addA(a(1))
    addS(a(1), s(1))
    await sm.revert()
    addA(a(2))
    addS(a(2), s(2))
    const json = [
      {
        address: '0xff00000000000000000000000000000000000001',
        storageKeys: ['0x0000000000000000000000000000000000000000000000000000000000000001'],
      },
      {
        address: '0xff00000000000000000000000000000000000002',
        storageKeys: ['0x0000000000000000000000000000000000000000000000000000000000000002'],
      },
    ]
    t.deepEqual(gen(), json)
    t.end()
  })

  it('one frame, one revert frame, same address, different slots', async (t) => {
    const { addA, addS, gen, sm } = getStateManagerAliases()
    await sm.checkpoint()
    addA(a(1))
    addS(a(1), s(1))
    await sm.revert()
    addA(a(1))
    addS(a(1), s(2))
    const json = [
      {
        address: '0xff00000000000000000000000000000000000001',
        storageKeys: [
          '0x0000000000000000000000000000000000000000000000000000000000000001',
          '0x0000000000000000000000000000000000000000000000000000000000000002',
        ],
      },
    ]
    t.deepEqual(gen(), json)
    t.end()
  })

  it('one frame, two revert frames', async (t) => {
    const { addA, addS, gen, sm } = getStateManagerAliases()
    await sm.checkpoint()
    await sm.checkpoint()
    addA(a(1))
    addS(a(1), s(1))
    await sm.revert()
    addA(a(2))
    addS(a(2), s(1))
    await sm.revert()
    addA(a(3))
    addS(a(3), s(1))
    const json = [
      {
        address: '0xff00000000000000000000000000000000000001',
        storageKeys: ['0x0000000000000000000000000000000000000000000000000000000000000001'],
      },
      {
        address: '0xff00000000000000000000000000000000000002',
        storageKeys: ['0x0000000000000000000000000000000000000000000000000000000000000001'],
      },
      {
        address: '0xff00000000000000000000000000000000000003',
        storageKeys: ['0x0000000000000000000000000000000000000000000000000000000000000001'],
      },
    ]
    t.deepEqual(gen(), json)
    t.end()
  })
})
