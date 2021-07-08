import tape from 'tape'
import { BN } from '../../util/dist'
import Common, { Chain, Hardfork } from '../src'

tape('[Common]: Hardfork logic', function (t: tape.Test) {
  t.test('Hardfork access', function (st: tape.Test) {
    const supportedHardforks = [
      'chainstart',
      'homestead',
      'dao',
      'tangerineWhistle',
      'spuriousDragon',
      'byzantium',
      'constantinople',
      'petersburg',
      'istanbul',
      'berlin',
    ]
    let c

    for (const hardfork of supportedHardforks) {
      c = new Common({ chain: 'mainnet', hardfork: hardfork })
      st.equal(c.hardfork(), hardfork, hardfork)
    }

    st.end()
  })

  t.test('getHardforkByBlockNumber() / setHardforkByBlockNumber()', function (st: tape.Test) {
    let c = new Common({ chain: 'mainnet' })
    let msg = 'should get HF correctly'

    st.equal(c.getHardforkByBlockNumber(0), 'chainstart', msg)
    st.equal(c.getHardforkByBlockNumber(1149999), 'chainstart', msg)
    st.equal(c.getHardforkByBlockNumber(1150000), 'homestead', msg)
    st.equal(c.getHardforkByBlockNumber(1400000), 'homestead', msg)
    st.equal(c.getHardforkByBlockNumber(9200000), 'muirGlacier', msg)
    st.equal(c.getHardforkByBlockNumber(12244000), 'berlin', msg)
    st.equal(c.getHardforkByBlockNumber(999999999999), 'berlin', msg)

    msg = 'should set HF correctly'

    st.equal(c.setHardforkByBlockNumber(0), 'chainstart', msg)
    st.equal(c.setHardforkByBlockNumber(1149999), 'chainstart', msg)
    st.equal(c.setHardforkByBlockNumber(1150000), 'homestead', msg)
    st.equal(c.setHardforkByBlockNumber(1400000), 'homestead', msg)
    st.equal(c.setHardforkByBlockNumber(12244000), 'berlin', msg)
    st.equal(c.setHardforkByBlockNumber(999999999999), 'berlin', msg)

    c = new Common({ chain: 'ropsten' })
    st.equal(c.setHardforkByBlockNumber(0), 'tangerineWhistle', msg)

    st.end()
  })

  t.test('setHardfork(): hardforkChanged event', function (st) {
    const c = new Common({ chain: 'mainnet', hardfork: 'istanbul' })
    c.on('hardforkChanged', (hardfork: string) => {
      st.equal(hardfork, 'byzantium', 'should send correct hardforkChanged event')
      st.end()
    })
    c.setHardfork('byzantium')
  })

  t.test('hardforkBlock()', function (st: tape.Test) {
    let c = new Common({ chain: 'ropsten' })
    let msg = 'should return the correct HF change block for byzantium (provided)'
    st.equal(c.hardforkBlock('byzantium'), 1700000, msg)

    c = new Common({ chain: 'ropsten', hardfork: 'byzantium' })
    msg = 'should return the correct HF change block for byzantium (set)'
    st.equal(c.hardforkBlock(), 1700000, msg)

    c = new Common({ chain: 'ropsten', hardfork: 'istanbul' })
    msg = 'should return the correct HF change block for istanbul (set)'
    st.equal(c.hardforkBlock(), 6485846, msg)

    st.end()
  })

  t.test('isHardforkBlock()', function (st: tape.Test) {
    let c = new Common({ chain: 'ropsten' })
    let msg = 'should return true for HF change block for byzantium (provided)'
    st.equal(c.isHardforkBlock(1700000, 'byzantium'), true, msg)

    msg = 'should return false for another block for byzantium (provided)'
    st.equal(c.isHardforkBlock(1700001, 'byzantium'), false, msg)

    c = new Common({ chain: 'ropsten', hardfork: 'byzantium' })
    msg = 'should return true for HF change block for byzantium (set)'
    st.equal(c.isHardforkBlock(1700000), true, msg)

    msg = 'should return false for another block for byzantium (set)'
    st.equal(c.isHardforkBlock(1700001), false, msg)

    st.end()
  })

  t.test('nextHardforkBlock()', function (st: tape.Test) {
    let c = new Common({ chain: 'rinkeby', hardfork: 'chainstart' })
    let msg =
      'should work with HF set / return correct next HF block for chainstart (rinkeby: chainstart -> homestead)'
    st.equal(c.nextHardforkBlock(), 1, msg)

    msg =
      'should correctly skip a HF where block is set to null (rinkeby: homestead -> (dao) -> tangerineWhistle)'
    st.equal(c.nextHardforkBlock('homestead'), 2, msg)

    msg = 'should return correct next HF (rinkeby: byzantium -> constantinople)'
    st.equal(c.nextHardforkBlock('byzantium'), 3660663, msg)

    msg = 'should return null if next HF is not available (rinkeby: berlin -> london)'
    st.equal(c.nextHardforkBlock('berlin'), null, msg)

    msg =
      'should work correctly along the need to skip several forks (ropsten: chainstart -> (homestead) -> (dao) -> (tangerineWhistle) -> spuriousDragon)'
    c = new Common({ chain: 'ropsten', hardfork: 'chainstart' })
    st.equal(c.nextHardforkBlock(), 10, msg)

    st.end()
  })

  t.test('isNextHardforkBlock()', function (st: tape.Test) {
    const c = new Common({ chain: 'rinkeby', hardfork: 'chainstart' })
    let msg =
      'should work with HF set / return true fro correct next HF block for chainstart (rinkeby: chainstart -> homestead)'
    st.equal(c.isNextHardforkBlock(1), true, msg)

    msg =
      'should correctly skip a HF where block is set to null (rinkeby: homestead -> (dao) -> tangerineWhistle)'
    st.equal(c.isNextHardforkBlock(2, 'homestead'), true, msg)

    msg = 'should return true for correct next HF (rinkeby: byzantium -> constantinople)'
    st.equal(c.isNextHardforkBlock(3660663, 'byzantium'), true, msg)

    msg = 'should return false for a block number too low (rinkeby: byzantium -> constantinople)'
    st.equal(c.isNextHardforkBlock(124, 'byzantium'), false, msg)

    msg = 'should return false for a block number too hight (rinkeby: byzantium -> constantinople)'
    st.equal(c.isNextHardforkBlock(605948938, 'byzantium'), false, msg)

    st.end()
  })

  t.test('activeHardforks()', function (st: tape.Test) {
    let c = new Common({ chain: 'ropsten' })
    let msg = 'should return 10 active hardforks for Ropsten'
    st.equal(c.activeHardforks().length, 10, msg)

    msg = 'should return the correct HF data for Ropsten'
    st.equal(c.activeHardforks()[3]['name'], 'spuriousDragon', msg)

    msg = 'should return 3 active hardforks for Ropsten up to block 9'
    st.equal(c.activeHardforks(9).length, 3, msg)

    msg = 'should return 4 active hardforks for Ropsten up to block 10'
    st.equal(c.activeHardforks(10).length, 4, msg)

    c = new Common({
      chain: 'ropsten',
      supportedHardforks: ['spuriousDragon', 'byzantium', 'constantinople'],
    })
    msg = 'should return 3 active HFs when restricted to supported HFs'
    st.equal(c.activeHardforks(null, { onlySupported: true }).length, 3, msg)

    c = new Common({
      chain: 'ropsten',
      supportedHardforks: ['spuriousDragon', 'byzantium', 'dao'],
    })
    msg = 'should return 2 active HFs when restricted to supported HFs'
    st.equal(c.activeHardforks(null, { onlySupported: true }).length, 2, msg)

    c = new Common({ chain: 'mainnet' })
    msg = 'should return 11 active HFs for mainnet'
    st.equal(c.activeHardforks().length, 11, msg)

    c = new Common({ chain: 'rinkeby' })
    msg = 'should return 9 active HFs for rinkeby'
    st.equal(c.activeHardforks().length, 9, msg)

    c = new Common({ chain: 'goerli' })
    msg = 'should return 9 active HFs for goerli'
    st.equal(c.activeHardforks().length, 9, msg)

    st.end()
  })

  t.test('activeHardfork()', function (st: tape.Test) {
    let c = new Common({ chain: 'ropsten' })
    let msg = 'should return berlin as latest active HF for Ropsten'
    st.equal(c.activeHardfork(), 'berlin', msg)

    msg = 'should return spuriousDragon as latest active HF for Ropsten for block 10'
    st.equal(c.activeHardfork(10), 'spuriousDragon', msg)

    c = new Common({
      chain: 'ropsten',
      supportedHardforks: ['tangerineWhistle', 'spuriousDragon'],
    })
    msg = 'should return spuriousDragon as latest active HF for Ropsten with limited supported HFs'
    st.equal(c.activeHardfork(null, { onlySupported: true }), 'spuriousDragon', msg)

    c = new Common({ chain: 'rinkeby' })
    msg = 'should return berlin as latest active HF for Rinkeby'
    st.equal(c.activeHardfork(), 'berlin', msg)

    st.end()
  })

  t.test('hardforkIsActiveOnBlock() / activeOnBlock()', function (st: tape.Test) {
    let c = new Common({ chain: 'ropsten' })
    let msg = 'Ropsten, byzantium (provided), 1700000 -> true'
    st.equal(c.hardforkIsActiveOnBlock('byzantium', 1700000), true, msg)

    msg = 'Ropsten, byzantium (provided), 1700005 -> true'
    st.equal(c.hardforkIsActiveOnBlock('byzantium', 1700005), true, msg)

    msg = 'Ropsten, byzantium (provided), 1699999 -> false'
    st.equal(c.hardforkIsActiveOnBlock('byzantium', 1699999), false, msg)

    c = new Common({ chain: 'ropsten', hardfork: 'byzantium' })
    msg = 'Ropsten, byzantium (set), 1700000 -> true'
    st.equal(c.hardforkIsActiveOnBlock(null, 1700000), true, msg)

    msg = 'Ropsten, byzantium (set), 1700000 -> true (alias function)'
    st.equal(c.activeOnBlock(1700000), true, msg)

    msg = 'Ropsten, byzantium (set), 1700005 -> true'
    st.equal(c.hardforkIsActiveOnBlock(null, 1700005), true, msg)

    msg = 'Ropsten, byzantium (set), 1699999 -> false'
    st.equal(c.hardforkIsActiveOnBlock(null, 1699999), false, msg)

    st.end()
  })

  t.test('hardforkBlock() / hardforkBlockBN()', function (st: tape.Test) {
    const c = new Common({ chain: Chain.Mainnet })

    let msg = 'should return correct value'
    st.equal(c.hardforkBlock(Hardfork.Berlin), 12244000, msg)
    st.ok(c.hardforkBlockBN(Hardfork.Berlin)!.eq(new BN(12244000)), msg)

    msg = 'should return null for unscheduled hardfork'
    st.equal(c.hardforkBlock(Hardfork.London), null, msg)
    st.equal(c.hardforkBlockBN(Hardfork.London), null, msg)
    st.equal(c.nextHardforkBlockBN(Hardfork.London), null, msg)
    // developer note: when London mainnet harfork block is set,
    // can update this test to next hardfork `Hardfork.Shanghai`

    st.end()
  })

  t.test('hardforkGteHardfork()', function (st: tape.Test) {
    let c = new Common({ chain: 'ropsten' })
    let msg = 'Ropsten, constantinople >= byzantium (provided) -> true'
    st.equal(c.hardforkGteHardfork('constantinople', 'byzantium'), true, msg)

    msg = 'Ropsten, dao >= chainstart (provided), onlyActive -> false'
    st.equal(
      c.hardforkGteHardfork('dao', 'chainstart', {
        onlyActive: true,
      }),
      false,
      msg
    )

    msg = 'Ropsten, byzantium >= byzantium (provided) -> true'
    st.equal(c.hardforkGteHardfork('byzantium', 'byzantium'), true, msg)

    msg = 'Ropsten, spuriousDragon >= byzantium (provided) -> false'
    st.equal(c.hardforkGteHardfork('spuriousDragon', 'byzantium'), false, msg)

    c = new Common({ chain: 'ropsten', hardfork: 'byzantium' })
    msg = 'Ropsten, byzantium (set) >= spuriousDragon -> true'
    st.equal(c.hardforkGteHardfork(null, 'spuriousDragon'), true, msg)

    msg = 'Ropsten, byzantium (set) >= spuriousDragon -> true (alias function)'
    st.equal(c.gteHardfork('spuriousDragon'), true, msg)

    msg = 'Ropsten, byzantium (set) >= spuriousDragon, onlyActive -> true'
    st.equal(c.hardforkGteHardfork(null, 'spuriousDragon', { onlyActive: true }), true, msg)

    msg = 'Ropsten, byzantium (set) >= byzantium -> true'
    st.equal(c.hardforkGteHardfork(null, 'byzantium'), true, msg)

    msg = 'Ropsten, byzantium (set) >= constantinople -> false'
    st.equal(c.hardforkGteHardfork(null, 'constantinople'), false, msg)

    st.end()
  })

  t.test('hardforkGteHardfork() ropsten', function (st: tape.Test) {
    const c = new Common({ chain: 'ropsten' })
    const msg = 'ropsten, spuriousDragon >= muirGlacier (provided) -> false'
    st.equal(c.hardforkGteHardfork('spuriousDragon', 'muirGlacier'), false, msg)

    st.end()
  })

  t.test('hardforkIsActiveOnChain()', function (st: tape.Test) {
    let c = new Common({ chain: 'ropsten' })
    let msg = 'should return true for byzantium (provided) on Ropsten'
    st.equal(c.hardforkIsActiveOnChain('byzantium'), true, msg)

    msg = 'should return false for dao (provided) on Ropsten'
    st.equal(c.hardforkIsActiveOnChain('dao'), false, msg)

    msg = 'should return true for petersburg (provided) on Ropsten'
    st.equal(c.hardforkIsActiveOnChain('petersburg'), true, msg)

    msg = 'should return false for a non-existing HF (provided) on Ropsten'
    st.equal(c.hardforkIsActiveOnChain('notexistinghardfork'), false, msg)

    let f = function () {
      c.hardforkIsActiveOnChain('spuriousDragon', { onlySupported: true })
    }
    msg = 'should not throw with unsupported Hf (provided) and onlySupported set to false'
    st.doesNotThrow(f, /unsupported hardfork$/, msg)

    c = new Common({ chain: 'ropsten', hardfork: 'byzantium' })
    msg = 'should return true for byzantium (set) on Ropsten'
    st.equal(c.hardforkIsActiveOnChain(), true, msg)

    c = new Common({
      chain: 'ropsten',
      supportedHardforks: ['byzantium', 'constantinople'],
    })
    f = function () {
      c.hardforkIsActiveOnChain('spuriousDragon', { onlySupported: true })
    }
    msg = 'should throw with unsupported Hf and onlySupported set to true'
    st.throws(f, /not set as supported in supportedHardforks$/, msg)

    st.end()
  })

  t.test('_calcForkHash()', function (st: tape.Test) {
    let c = new Common({ chain: 'mainnet' })
    let msg = 'should calc correctly for chainstart (only genesis)'
    st.equal(c._calcForkHash('chainstart'), '0xfc64ec04', msg)

    msg = 'should calc correctly for first applied HF'
    st.equal(c._calcForkHash('homestead'), '0x97c2c34c', msg)

    msg = 'should calc correctly for in-between applied HF'
    st.equal(c._calcForkHash('byzantium'), '0xa00bc324', msg)

    const chains = ['mainnet', 'ropsten', 'rinkeby', 'goerli', 'kovan']

    chains.forEach((chain) => {
      c = new Common({ chain: chain })

      for (const hf of c.hardforks()) {
        if (hf.forkHash && hf.forkHash !== null) {
          const msg = `Verify forkHash calculation for: ${chain} -> ${hf.name}`
          st.equal(c._calcForkHash(hf.name), hf.forkHash, msg)
        }
      }
    })

    st.end()
  })

  t.test('forkHash()', function (st: tape.Test) {
    let c = new Common({ chain: 'mainnet', hardfork: 'byzantium' })
    let msg = 'should provide correct forkHash for HF set'
    st.equal(c.forkHash(), '0xa00bc324', msg)

    msg = 'should provide correct forkHash for HF provided'
    st.equal(c.forkHash('spuriousDragon'), '0x3edd5b10', msg)

    c = new Common({ chain: 'ropsten' })
    const f = () => {
      c.forkHash('dao')
    }
    msg = 'should throw when called on non-applied or future HF'
    st.throws(f, /No fork hash calculation possible/, msg)

    st.end()
  })

  t.test('hardforkForForkHash()', function (st: tape.Test) {
    const c = new Common({ chain: 'mainnet' })

    let msg = 'should return the correct HF array for a matching forkHash'
    const res = c.hardforkForForkHash('0x3edd5b10')
    st.equal(res.name, 'spuriousDragon', msg)

    msg = 'should return null for a forkHash not matching any HF'
    st.equal(c.hardforkForForkHash('0x12345'), null, msg)

    st.end()
  })
})
