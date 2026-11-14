/**
 * 操作・進行まわりの純粋ロジック（押し順ナビ / シーン別BGM / デバッグ強制指定）のテスト。
 *
 * 実行: npm run test:game
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { NAVI_PATTERNS, SPIN_ROLES, getNaviNumbers } from '../engine.ts'
import type { NaviOrder, Scene } from '../engine.ts'
import {
  isNaviMissOnStop,
  pickBonusStopReel,
  pickNaviStopReel,
  resolveNaviReelDisplay,
  type NaviDisplayContext,
} from './navi.ts'
import { resolveSceneBgmTrack } from './sceneBgm.ts'
import { DEBUG_SPIN_ROLE_OPTIONS, resolveDebugSpinRequest } from './debugOptions.ts'

const BELL = { symbol: 'bell', isReplay: false } as const
const REPLAY = { symbol: 'replay', isReplay: true } as const

describe('navi: 押し順ミス判定', () => {
  const order: NaviOrder = [2, 0, 1]

  it('雑魚戦のベルは第1〜第3停止すべて押し順通りでないとミス', () => {
    order.forEach((reel, step) => {
      assert.equal(isNaviMissOnStop({ target: BELL, isBattleMode: false, stopCount: step, reelIndex: reel, naviOrder: order }), false)
    })
    assert.equal(isNaviMissOnStop({ target: BELL, isBattleMode: false, stopCount: 1, reelIndex: 1, naviOrder: order }), true)
  })

  it('BATTLE MODE中のベルは第1停止のみ判定（第2・第3停止は順不同）', () => {
    assert.equal(isNaviMissOnStop({ target: BELL, isBattleMode: true, stopCount: 0, reelIndex: 0, naviOrder: order }), true)
    assert.equal(isNaviMissOnStop({ target: BELL, isBattleMode: true, stopCount: 0, reelIndex: 2, naviOrder: order }), false)
    assert.equal(isNaviMissOnStop({ target: BELL, isBattleMode: true, stopCount: 1, reelIndex: 1, naviOrder: order }), false)
  })

  it('リプレイ・ベル以外は押し順不問', () => {
    for (const isBattleMode of [false, true]) {
      assert.equal(isNaviMissOnStop({ target: REPLAY, isBattleMode, stopCount: 0, reelIndex: 0, naviOrder: order }), false)
      assert.equal(
        isNaviMissOnStop({ target: { symbol: 'cherry', isReplay: false }, isBattleMode, stopCount: 0, reelIndex: 0, naviOrder: order }),
        false
      )
    }
  })
})

describe('navi: 自動停止のリール選択', () => {
  it('全6通りの押し順でナビ通りに3リールを止める', () => {
    for (const order of NAVI_PATTERNS) {
      const stopped: [boolean, boolean, boolean] = [false, false, false]
      const picked: number[] = []
      for (let step = 0; step < 3; step++) {
        const reel = pickNaviStopReel(order, step, stopped)
        picked.push(reel)
        stopped[reel] = true
      }
      assert.deepEqual(picked, order)
      assert.equal(pickNaviStopReel(order, 3, stopped), -1)
    }
  })

  it('ナビ対象が停止済みなら左から最初の未停止リール', () => {
    assert.equal(pickNaviStopReel([1, 2, 0], 0, [false, true, false]), 0)
  })

  it('ボーナス揃えは左から順', () => {
    assert.equal(pickBonusStopReel([false, false, false]), 0)
    assert.equal(pickBonusStopReel([true, false, false]), 1)
    assert.equal(pickBonusStopReel([true, true, true]), -1)
  })
})

describe('navi: ナビランプ表示', () => {
  const order: NaviOrder = [1, 2, 0]
  const base: NaviDisplayContext = {
    scene: 'spinning',
    spin: BELL,
    stopped: [false, false, false],
    isBattleMode: false,
    naviOrder: order,
    naviNumbers: getNaviNumbers(order),
    naviStep: 0,
  }
  const all = (ctx: NaviDisplayContext) => [0, 1, 2].map((i) => resolveNaviReelDisplay(ctx, i))

  it('雑魚戦のベルは押し順番号を全リールに表示し、次の対象のみ target', () => {
    assert.deepEqual(all(base).map((d) => d.num), [3, 1, 2])
    assert.deepEqual(all(base).map((d) => d.segment), ['wait', 'target', 'wait'])
    const step1 = all({ ...base, stopped: [false, true, false], naviStep: 1 })
    assert.deepEqual(step1.map((d) => d.segment), ['wait', 'idle', 'target'])
  })

  it('BATTLE MODE中は第1停止のみ表示し、第1停止後は全て idle', () => {
    const battle = { ...base, isBattleMode: true }
    assert.deepEqual(all(battle).map((d) => d.num), ['-', 1, '-'])
    assert.deepEqual(all(battle).map((d) => d.segment), ['wait', 'target', 'wait'])
    const after = all({ ...battle, stopped: [false, true, false], naviStep: 1 })
    assert.deepEqual(after.map((d) => d.segment), ['idle', 'idle', 'idle'])
    assert.ok(after.every((d) => !d.isTarget))
  })

  it('リプレイはナビ非表示', () => {
    const rep = all({ ...base, spin: REPLAY })
    assert.ok(rep.every((d) => d.segment === 'idle' && d.num === '-' && !d.isTarget))
  })

  it('ボーナス揃えは 1-2-3 表示で左から順に target', () => {
    const bonus = all({ ...base, scene: 'bonusSpin', spin: null, stopped: [true, false, false] })
    assert.deepEqual(bonus.map((d) => d.num), [1, 2, 3])
    assert.deepEqual(bonus.map((d) => d.segment), ['idle', 'target', 'wait'])
  })
})

describe('sceneBgm', () => {
  it('シーンごとのBGMトラック', () => {
    const cases: Array<[Scene, boolean, ReturnType<typeof resolveSceneBgmTrack>]> = [
      ['bonusSpin', false, null],
      ['bonusGet', false, 'opening'],
      ['ready', false, 'pre_battle'],
      ['lever', false, 'pre_battle'],
      ['spinning', false, 'pre_battle'],
      ['battleModeIntro', false, 'battle'],
      ['ready', true, 'battle'],
      ['spinning', true, 'battle'],
      ['finished', false, 'gameover'],
    ]
    for (const [scene, isBattleMode, expected] of cases) {
      assert.equal(resolveSceneBgmTrack(scene, isBattleMode), expected, `${scene}/${isBattleMode}`)
    }
  })
})

describe('debugOptions', () => {
  it('強制役の選択肢は抽選可能な全役＋スイカのストック有無を含む', () => {
    const ids = DEBUG_SPIN_ROLE_OPTIONS.map((o) => o.id)
    for (const role of SPIN_ROLES) {
      if (role.id === 'melon') continue
      assert.ok(ids.includes(role.id), role.id)
    }
    assert.ok(ids.includes('melon:stock') && ids.includes('melon:no_stock'))
  })

  it('未指定ならオプションなし', () => {
    assert.deepEqual(resolveDebugSpinRequest(null, 'auto', 'auto'), { roleId: null, options: undefined })
  })

  it('スイカのストック指定はストック抽選指定より優先', () => {
    assert.deepEqual(resolveDebugSpinRequest('melon:stock', 'lose', 'auto'), {
      roleId: 'melon',
      options: { forcedStockWon: true },
    })
    assert.deepEqual(resolveDebugSpinRequest('melon:no_stock', 'win', 'off'), {
      roleId: 'melon',
      options: { forcedStockWon: false, forcedBarAim: false },
    })
  })

  it('ストック・BAR演出の個別指定', () => {
    assert.deepEqual(resolveDebugSpinRequest('cherry:triple', 'win', 'on'), {
      roleId: 'cherry:triple',
      options: { forcedStockWon: true, forcedBarAim: true },
    })
    assert.deepEqual(resolveDebugSpinRequest(null, 'auto', 'on'), { roleId: null, options: { forcedBarAim: true } })
  })
})
