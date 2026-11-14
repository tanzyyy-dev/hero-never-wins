import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  BAR_AIM_RATES,
  BATTLE_MESSAGES,
  BATTLE_SCENARIOS,
  DEBUG_BATTLE_SCENARIOS,
  BELL_PAYOUT,
  BET_COST,
  CHERRY_CONFIGS,
  CHERRY_PAYOUT,
  CREDIT_MAX,
  MELON_PAYOUT,
  MELON_RATE,
  MELON_STOCK_RATE,
  PREMIUM_BAR_PAYOUT,
  PREMIUM_BAR_RATE,
  PREMIUM_BAR_STOCK_GAIN,
  RATES,
  SETTINGS,
  SPIN_ROLES,
  calculateMedalPayout,
  drawBarAimCutin,
  drawCherryStock,
  drawCherryType,
  drawMelonStock,
  drawSettingIndex,
  drawSpin,
  getMissReels,
  getReelWindow,
  resolveBattleWithStock,
  resolveDebugBattleSelection,
  resolveTopLampMode,
} from './engine.ts'

/** 決定論的PRNG (Mulberry32) */
function makeRng(seed = 123456789): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 固定値列を返すRNG */
function sequenceRng(values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]!
}

describe('SETTINGS probability table', () => {
  it('has 6 settings with specified battle rates and 100% total weights', () => {
    assert.equal(SETTINGS.length, 6)
    assert.deepEqual(RATES, [0.50, 0.60, 0.68, 0.76, 0.83, 0.89])

    const totalSelectionWeight = SETTINGS.reduce((sum, s) => sum + s.selectionWeight, 0)
    assert.ok(Math.abs(totalSelectionWeight - 1.0) < 1e-9)

    for (const s of SETTINGS) {
      assert.equal(s.bellRate, 0.65)
      assert.equal(s.melonRate, MELON_RATE)
      assert.equal(s.premiumBarRate, PREMIUM_BAR_RATE)
      assert.equal(s.premiumBarRate, 1 / 65536)
      const totalRoleRate = s.bellRate + s.replayRate + s.cherryRate + s.melonRate + s.premiumBarRate
      assert.ok(Math.abs(totalRoleRate - 1.0) < 1e-9, `Setting ${s.setting} sum=${totalRoleRate}`)
    }

    assert.deepEqual(
      SETTINGS.map((s) => s.replayRate),
      [0.26, 0.31, 0.30, 0.30, 0.31, 0.26]
    )
    assert.deepEqual(
      SETTINGS.map((s) => s.cherryRate),
      [0.08, 0.03, 0.04, 0.04, 0.03, 0.08]
    )
  })

  it('setting 1 and 6 have higher cherry rate than settings 2-5', () => {
    assert.equal(SETTINGS[0]!.cherryRate, 0.08)
    assert.equal(SETTINGS[5]!.cherryRate, 0.08)
    for (let i = 1; i <= 4; i++) {
      assert.ok(SETTINGS[i]!.cherryRate < SETTINGS[0]!.cherryRate)
      assert.ok(SETTINGS[i]!.cherryRate < SETTINGS[5]!.cherryRate)
    }
  })

  it('drawSettingIndex matches weighted distribution over 100,000 trials', () => {
    const rng = makeRng(42)
    const counts = [0, 0, 0, 0, 0, 0]
    const N = 100_000
    for (let i = 0; i < N; i++) {
      counts[drawSettingIndex(rng)]!++
    }
    const expected = [0.40, 0.25, 0.15, 0.10, 0.07, 0.03]
    for (let i = 0; i < 6; i++) {
      const actual = counts[i]! / N
      assert.ok(
        Math.abs(actual - expected[i]!) < 0.008,
        `Setting ${i + 1}: expected ${expected[i]}, got ${actual}`
      )
    }
  })
})

describe('Cherry & Spin lottery', () => {
  it('draws 3 cherry types with weights 5% / 25% / 70% over 100,000 trials', () => {
    const rng = makeRng(777)
    const counts = { single: 0, double: 0, triple: 0 }
    const N = 100_000
    for (let i = 0; i < N; i++) {
      counts[drawCherryType(rng)]++
    }
    assert.ok(Math.abs(counts.single / N - 0.05) < 0.004, `single=${counts.single / N}`)
    assert.ok(Math.abs(counts.double / N - 0.25) < 0.006, `double=${counts.double / N}`)
    assert.ok(Math.abs(counts.triple / N - 0.70) < 0.006, `triple=${counts.triple / N}`)
  })

  it('awards stock at 100% for single, 25% for double, 5% for triple (14.75% combined)', () => {
    // Boundary checks
    assert.equal(drawCherryStock('single', sequenceRng([0.9999])), true)
    assert.equal(drawCherryStock('double', sequenceRng([0.2499])), true)
    assert.equal(drawCherryStock('double', sequenceRng([0.25])), false)
    assert.equal(drawCherryStock('triple', sequenceRng([0.0499])), true)
    assert.equal(drawCherryStock('triple', sequenceRng([0.05])), false)

    // Monte Carlo check
    const rng = makeRng(999)
    const N = 100_000
    let doubleWins = 0
    let tripleWins = 0
    let combinedWins = 0
    for (let i = 0; i < N; i++) {
      if (!drawCherryStock('single', rng)) assert.fail('single cherry must always win stock')
      if (drawCherryStock('double', rng)) doubleWins++
      if (drawCherryStock('triple', rng)) tripleWins++
      const t = drawCherryType(rng)
      if (drawCherryStock(t, rng)) combinedWins++
    }
    assert.ok(Math.abs(doubleWins / N - 0.25) < 0.006, `double=${doubleWins / N}`)
    assert.ok(Math.abs(tripleWins / N - 0.05) < 0.004, `triple=${tripleWins / N}`)
    assert.ok(Math.abs(combinedWins / N - 0.1475) < 0.005, `combined=${combinedWins / N}`)
  })

  it('produces distinct reel patterns and 8-medal payout for all cherry types', () => {
    assert.equal(BELL_PAYOUT, 12)
    assert.equal(CHERRY_PAYOUT, 8)
    assert.deepEqual(CHERRY_CONFIGS.single.reels, ['cherry', 'bar', 'blank'])
    assert.deepEqual(CHERRY_CONFIGS.double.reels, ['cherry', 'cherry', 'blank'])
    assert.deepEqual(CHERRY_CONFIGS.triple.reels, ['cherry', 'cherry', 'cherry'])
    assert.equal(CHERRY_CONFIGS.single.payout, 8)
    assert.equal(CHERRY_CONFIGS.double.payout, 8)
    assert.equal(CHERRY_CONFIGS.triple.payout, 8)

    // Verify no extra cherry symbols appear in top/bottom of non-cherry reels
    for (const type of ['single', 'double', 'triple'] as const) {
      const reels = CHERRY_CONFIGS[type].reels
      reels.forEach((centerSym, idx) => {
        const win = getReelWindow(centerSym, idx)
        if (centerSym !== 'cherry') {
          assert.ok(!win.includes('cherry'), `${type} reel ${idx} unexpectedly shows cherry in window ${win}`)
        }
      })
    }
  })

  it('getMissReels("cherry") produces a non-cherry miss window', () => {
    const miss = getMissReels('cherry')
    assert.ok(!miss.includes('cherry'))
  })

  it('drawSpin matches setting role probabilities over 100,000 trials for each setting', () => {
    const N = 100_000
    for (let settingIdx = 0; settingIdx < SETTINGS.length; settingIdx++) {
      const rng = makeRng(1000 + settingIdx)
      const cfg = SETTINGS[settingIdx]!
      let bell = 0
      let replay = 0
      let cherry = 0
      let melon = 0
      let bar = 0
      for (let i = 0; i < N; i++) {
        const out = drawSpin(settingIdx, rng)
        if (out.symbol === 'bell') {
          bell++
          assert.equal(out.payout, 12)
          assert.equal(out.isReplay, false)
          assert.equal(out.stockGain, 0)
          assert.equal(out.barAim, false)
        } else if (out.symbol === 'replay') {
          replay++
          assert.equal(out.payout, 0)
          assert.equal(out.isReplay, true)
          assert.equal(out.stockGain, 0)
          assert.equal(out.barAim, false)
        } else if (out.symbol === 'cherry') {
          cherry++
          assert.equal(out.payout, 8)
          assert.equal(out.isReplay, false)
          assert.ok(out.cherryType !== undefined)
          assert.ok(out.stockGain === 0 || out.stockGain === 1)
          assert.equal(typeof out.barAim, 'boolean')
        } else if (out.symbol === 'melon') {
          melon++
          assert.equal(out.payout, MELON_PAYOUT)
          assert.equal(out.isReplay, false)
          assert.deepEqual(out.reels, ['melon', 'melon', 'melon'])
          assert.ok(out.stockGain === 0 || out.stockGain === 1)
          assert.equal(typeof out.barAim, 'boolean')
        } else if (out.symbol === 'bar') {
          bar++
          assert.equal(out.payout, PREMIUM_BAR_PAYOUT)
          assert.equal(out.isReplay, false)
          assert.deepEqual(out.reels, ['bar', 'bar', 'bar'])
          assert.equal(out.stockGain, PREMIUM_BAR_STOCK_GAIN)
          assert.equal(out.barAim, true)
        } else {
          assert.fail(`Unexpected symbol: ${out.symbol}`)
        }
      }
      assert.ok(Math.abs(bell / N - cfg.bellRate) < 0.006, `Setting ${cfg.setting} bell=${bell / N}`)
      assert.ok(Math.abs(replay / N - cfg.replayRate) < 0.006, `Setting ${cfg.setting} replay=${replay / N}`)
      assert.ok(Math.abs(cherry / N - cfg.cherryRate) < 0.005, `Setting ${cfg.setting} cherry=${cherry / N}`)
      assert.ok(Math.abs(melon / N - cfg.melonRate) < 0.002, `Setting ${cfg.setting} melon=${melon / N}`)
      assert.ok(bar >= 0)
    }
  })

  it('deterministically hits melon and premium_bar at exact RNG boundaries across all settings', () => {
    for (let settingIdx = 0; settingIdx < SETTINGS.length; settingIdx++) {
      const cfg = SETTINGS[settingIdx]!
      const melonStart = cfg.bellRate + cfg.replayRate + cfg.cherryRate
      const barStart = melonStart + cfg.melonRate

      // Just below melonStart -> cherry
      const cherryEdge = drawSpin(settingIdx, sequenceRng([0.0, melonStart - 1e-12, 0.5, 0.5, 0.5]))
      assert.equal(cherryEdge.symbol, 'cherry')

      // At melonStart -> melon
      const melonLow = drawSpin(settingIdx, sequenceRng([0.0, melonStart + 1e-12, 0.5, 0.5]))
      assert.equal(melonLow.symbol, 'melon')
      assert.equal(melonLow.payout, 8)
      assert.deepEqual(melonLow.reels, ['melon', 'melon', 'melon'])

      // Just below barStart -> melon
      const melonHigh = drawSpin(settingIdx, sequenceRng([0.0, barStart - 1e-12, 0.5, 0.5]))
      assert.equal(melonHigh.symbol, 'melon')

      // At barStart (1 - 1/65536) -> premium_bar
      const barLow = drawSpin(settingIdx, sequenceRng([0.0, barStart + 1e-12]))
      assert.equal(barLow.symbol, 'bar')
      assert.equal(barLow.payout, 15)
      assert.equal(barLow.stockGain, 20)
      assert.deepEqual(barLow.reels, ['bar', 'bar', 'bar'])
      assert.equal(barLow.barAim, true)

      // Near 1.0 -> premium_bar
      const barHigh = drawSpin(settingIdx, sequenceRng([0.0, 0.9999999]))
      assert.equal(barHigh.symbol, 'bar')
      assert.equal(barHigh.stockGain, 20)
    }
  })

  it('awards melon stock at 10% (boundary + Monte Carlo)', () => {
    assert.equal(MELON_STOCK_RATE, 0.10)
    assert.equal(drawMelonStock(sequenceRng([0.09999])), true)
    assert.equal(drawMelonStock(sequenceRng([0.10])), false)

    const rng = makeRng(31415)
    const N = 100_000
    let wins = 0
    for (let i = 0; i < N; i++) {
      if (drawMelonStock(rng)) wins++
    }
    assert.ok(Math.abs(wins / N - 0.10) < 0.004, `melon stock rate=${wins / N}`)
  })

  it('separates BAR aim presentation lottery from role outcome', () => {
    assert.equal(BAR_AIM_RATES.bell, 0)
    assert.equal(BAR_AIM_RATES.replay, 0)
    assert.equal(BAR_AIM_RATES.cherry, 0.01)
    assert.equal(BAR_AIM_RATES.melon, 0.10)
    assert.equal(BAR_AIM_RATES.bar, 1.0)

    assert.equal(drawBarAimCutin('bell', sequenceRng([0.0])), false)
    assert.equal(drawBarAimCutin('replay', sequenceRng([0.0])), false)
    assert.equal(drawBarAimCutin('cherry', sequenceRng([0.0099])), true)
    assert.equal(drawBarAimCutin('cherry', sequenceRng([0.01])), false)
    assert.equal(drawBarAimCutin('melon', sequenceRng([0.0999])), true)
    assert.equal(drawBarAimCutin('melon', sequenceRng([0.10])), false)
    assert.equal(drawBarAimCutin('bar', sequenceRng([0.9999])), true)

    // Forced BAR aim on cherry/melon must not alter payout, reels, or stockGain
    const cherryWithBarAim = drawSpin(0, sequenceRng([0.0, 0.99]), 'cherry:single', {
      forcedStockWon: true,
      forcedBarAim: true,
    })
    assert.equal(cherryWithBarAim.symbol, 'cherry')
    assert.equal(cherryWithBarAim.payout, 8)
    assert.equal(cherryWithBarAim.stockGain, 1)
    assert.equal(cherryWithBarAim.barAim, true)

    const cherryWithoutBarAim = drawSpin(0, sequenceRng([0.0, 0.99]), 'cherry:single', {
      forcedStockWon: true,
      forcedBarAim: false,
    })
    assert.equal(cherryWithoutBarAim.symbol, 'cherry')
    assert.equal(cherryWithoutBarAim.payout, 8)
    assert.equal(cherryWithoutBarAim.stockGain, 1)
    assert.equal(cherryWithoutBarAim.barAim, false)
  })
})

describe('Medal payout and long-run growth', () => {
  it('splits credit (max 50) and tray overflow accurately for bell (12) and cherry (8)', () => {
    // Credit 47 after 3-medal BET: bell 12 -> 3 to credit (50), 9 to tray
    assert.deepEqual(calculateMedalPayout(47, BELL_PAYOUT), {
      nextCredit: CREDIT_MAX,
      toCredit: 3,
      toTray: 9,
    })
    // Credit 47 after 3-medal BET: cherry 8 -> 3 to credit (50), 5 to tray
    assert.deepEqual(calculateMedalPayout(47, CHERRY_PAYOUT), {
      nextCredit: CREDIT_MAX,
      toCredit: 3,
      toTray: 5,
    })
    // Credit 30: bell 12 -> all 12 to credit (42), 0 to tray
    assert.deepEqual(calculateMedalPayout(30, BELL_PAYOUT), {
      nextCredit: 42,
      toCredit: 12,
      toTray: 0,
    })
  })

  it('grows total medals consistently over long-run spins without double counting', () => {
    const rng = makeRng(2026)
    let credit = CREDIT_MAX
    let totalMedals = 0
    let isReplayPending = false
    let expectedNetFromCredits = 0

    for (let i = 0; i < 1000; i++) {
      if (!isReplayPending) {
        credit -= BET_COST
        expectedNetFromCredits -= BET_COST
      }
      isReplayPending = false

      const spin = drawSpin(5, rng)
      if (spin.isReplay) {
        isReplayPending = true
      } else {
        const res = calculateMedalPayout(credit, spin.payout)
        credit = res.nextCredit
        totalMedals += res.toTray
        expectedNetFromCredits += spin.payout
      }
    }

    assert.equal(credit, CREDIT_MAX)
    assert.equal(totalMedals, expectedNetFromCredits)
    assert.ok(totalMedals > 5000, `Expected >5000 net medals over 1000 spins, got ${totalMedals}`)
  })
})

describe('Battle resolution with stock', () => {
  it('does not consume stock when continuation roll succeeds', () => {
    const res = resolveBattleWithStock(0.50, 3, sequenceRng([0.1, 0.2]))
    assert.notEqual(res.pattern, 'defeat')
    assert.equal(res.usedStock, false)
    assert.equal(res.nextStockCount, 3)
  })

  it('consumes 1 stock and continues with a non-defeat pattern when continuation roll fails and stock > 0', () => {
    const res = resolveBattleWithStock(0.50, 2, sequenceRng([0.9, 0.99]))
    assert.notEqual(res.pattern, 'defeat')
    assert.equal(res.usedStock, true)
    assert.equal(res.nextStockCount, 1)
  })

  it('ends in defeat only when continuation roll fails and stock === 0', () => {
    const res = resolveBattleWithStock(0.50, 0, sequenceRng([0.9]))
    assert.equal(res.pattern, 'defeat')
    assert.equal(res.usedStock, false)
    assert.equal(res.nextStockCount, 0)
  })
})

describe('Debug forced role and battle scenario catalogs', () => {
  it('exposes only drawable spin roles and forces each one accurately', () => {
    const ids = SPIN_ROLES.map((r) => r.id)
    assert.deepEqual(ids, ['bell', 'replay', 'cherry:single', 'cherry:double', 'cherry:triple', 'melon', 'premium_bar'])

    for (const role of SPIN_ROLES) {
      const outcome = drawSpin(0, sequenceRng([0.0]), role.id)
      assert.equal(outcome.symbol, role.symbol)
      if (role.id.startsWith('cherry:')) {
        assert.equal(outcome.cherryType, role.id.split(':')[1])
      }
    }

    const melonNoStock = drawSpin(0, sequenceRng([0.0]), 'melon', { forcedStockWon: false })
    assert.equal(melonNoStock.symbol, 'melon')
    assert.equal(melonNoStock.stockGain, 0)
    assert.equal(melonNoStock.payout, 8)

    const melonWithStock = drawSpin(0, sequenceRng([0.99]), 'melon', { forcedStockWon: true })
    assert.equal(melonWithStock.symbol, 'melon')
    assert.equal(melonWithStock.stockGain, 1)
    assert.equal(melonWithStock.payout, 8)

    const barForced = drawSpin(0, sequenceRng([0.99]), 'premium_bar')
    assert.equal(barForced.symbol, 'bar')
    assert.equal(barForced.stockGain, 20)
    assert.equal(barForced.payout, 15)
    assert.equal(barForced.barAim, true)
  })

  it('derives battle scenarios from BATTLE_MESSAGES and forces each scenario without consuming stock', () => {
    assert.deepEqual(
      BATTLE_SCENARIOS.map((s) => s.id),
      Object.keys(BATTLE_MESSAGES)
    )

    for (const scenario of BATTLE_SCENARIOS) {
      const res = resolveBattleWithStock(0.50, 2, sequenceRng([0.99]), scenario.id)
      assert.equal(res.pattern, scenario.id)
      assert.equal(res.usedStock, false)
      assert.equal(res.nextStockCount, 2)
    }
  })

  it('includes special victory gameover option in DEBUG_BATTLE_SCENARIOS and resolves it to hero_attack with special defeat flag', () => {
    assert.deepEqual(
      DEBUG_BATTLE_SCENARIOS.map((s) => s.id),
      [...BATTLE_SCENARIOS.map((s) => s.id), 'victory_gameover']
    )

    assert.deepEqual(resolveDebugBattleSelection(null), {
      forcedPattern: null,
      isSpecialEnemyDefeat: false,
    })

    const special = resolveDebugBattleSelection('victory_gameover')
    assert.deepEqual(special, {
      forcedPattern: 'hero_attack',
      isSpecialEnemyDefeat: true,
    })
    const res = resolveBattleWithStock(0.50, 2, sequenceRng([0.99]), special.forcedPattern)
    assert.equal(res.pattern, 'hero_attack')
    assert.equal(res.usedStock, false)
    assert.equal(res.nextStockCount, 2)

    for (const scenario of BATTLE_SCENARIOS) {
      assert.deepEqual(resolveDebugBattleSelection(scenario.id), {
        forcedPattern: scenario.id,
        isSpecialEnemyDefeat: false,
      })
    }
  })
})

describe('resolveTopLampMode', () => {
  const base = {
    scene: 'ready',
    payout: 0,
    spinSymbol: null,
    litRole: null,
    showPremiumBarEffect: false,
    winLamp: false,
    battle: 'hero_attack' as const,
  }

  it('uses non-role modes for normal idle, lever, and spinning states', () => {
    assert.equal(resolveTopLampMode({ ...base, scene: 'ready' }), 'ready')
    assert.equal(resolveTopLampMode({ ...base, scene: 'lever' }), 'lever')
    assert.equal(resolveTopLampMode({ ...base, scene: 'spinning' }), 'spin')
  })

  it('maps each small role win to its dedicated lamp mode', () => {
    assert.equal(resolveTopLampMode({ ...base, payout: 12, spinSymbol: 'bell', litRole: 'bell' }), 'payout')
    assert.equal(resolveTopLampMode({ ...base, scene: 'lever', payout: 0, spinSymbol: 'replay', litRole: 'replay' }), 'payout-replay')
    assert.equal(resolveTopLampMode({ ...base, payout: 8, spinSymbol: 'cherry' }), 'payout-cherry')
    assert.equal(resolveTopLampMode({ ...base, payout: 8, spinSymbol: 'melon' }), 'payout-melon')
    assert.equal(resolveTopLampMode({ ...base, payout: 15, spinSymbol: 'bar', showPremiumBarEffect: true }), 'rainbow')
    assert.equal(resolveTopLampMode({ ...base, payout: 15, spinSymbol: 'bar', showPremiumBarEffect: false }), 'rainbow')
  })

  it('falls back to ready on navi miss without payout or litRole', () => {
    assert.equal(resolveTopLampMode({ ...base, scene: 'ready', payout: 0, spinSymbol: 'bell', litRole: null }), 'ready')
  })

  it('prioritizes rainbow and battle modes for bonus and battle scenes', () => {
    assert.equal(resolveTopLampMode({ ...base, scene: 'bonusSpin' }), 'rainbow')
    assert.equal(resolveTopLampMode({ ...base, scene: 'bonusGet' }), 'rainbow')
    assert.equal(resolveTopLampMode({ ...base, winLamp: true }), 'rainbow')
    assert.equal(resolveTopLampMode({ ...base, scene: 'battleResult', battle: 'hero_attack' }), 'rainbow')
    assert.equal(resolveTopLampMode({ ...base, scene: 'battleModeIntro' }), 'battle')
    assert.equal(resolveTopLampMode({ ...base, scene: 'battle' }), 'battle')
  })
})
