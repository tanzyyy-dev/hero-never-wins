/**
 * 筐体レスポンシブスケーリング（docs/cabinet-responsive-layout.md）のテスト。
 *
 * 実行: npm run test:layout
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  CABINET_BASE_HEIGHT,
  CABINET_BASE_WIDTH,
  CABINET_COMPACT_MIN_HEIGHT,
  CABINET_MAX_STRETCH_HEIGHT,
  computeCabinetLayout,
} from './cabinetLayout.ts'

/** 代表的なスマホ縦画面（CSS px） */
const PHONES_PORTRAIT: Array<[string, number, number]> = [
  ['iPhone SE', 375, 667],
  ['iPhone 16', 393, 852],
  ['iPhone 16 Pro Max', 440, 956],
  ['Pixel 7', 412, 915],
  ['Galaxy S8', 360, 740],
  ['small 320x568', 320, 568],
]

describe('cabinetLayout: スマホ縦画面', () => {
  for (const [name, vw, vh] of PHONES_PORTRAIT) {
    it(`${name} (${vw}x${vh}) はスクロールなしで1画面に収まる`, () => {
      const l = computeCabinetLayout(vw, vh)
      assert.equal(l.isMobilePortrait, true)
      assert.equal(l.needsScroll, false)
      assert.ok(l.stageHeight <= vh, `stageHeight ${l.stageHeight} > ${vh}`)
      assert.ok(l.stageWidth + l.sideSpace * 2 <= vw, 'horizontal overflow')
      assert.ok(l.cabinetHeight >= CABINET_COMPACT_MIN_HEIGHT && l.cabinetHeight <= CABINET_MAX_STRETCH_HEIGHT)
    })
  }

  it('縦寸不足（論理高さ < 840）で bottom-compact になる', () => {
    assert.equal(computeCabinetLayout(375, 667).isBottomCompact, true)
    assert.equal(computeCabinetLayout(393, 852).isBottomCompact, false)
  })

  it('筐体幅より広い縦画面では左右余白（サイドフレーム領域）が生じる', () => {
    const l = computeCabinetLayout(600, 1000)
    assert.equal(l.isMobilePortrait, true)
    assert.ok(l.sideSpace > 0)
  })
})

describe('cabinetLayout: 横画面・PC', () => {
  it('高さ 550px 以下の横画面は landscape compact（スケールなし）', () => {
    const l = computeCabinetLayout(852, 393)
    assert.equal(l.isLandscapeCompact, true)
    assert.equal(l.scale, 1)
    assert.equal(l.stageHeight, 393)
  })

  it('十分広いPC画面は等倍で中央配置', () => {
    const l = computeCabinetLayout(1440, 1000)
    assert.equal(l.isMobilePortrait, false)
    assert.equal(l.scale, 1)
    assert.equal(l.stageWidth, CABINET_BASE_WIDTH)
    assert.equal(l.stageHeight, CABINET_BASE_HEIGHT)
    assert.equal(l.needsScroll, false)
  })

  it('高さが足りないPC画面は高さに合わせて縮小し、スクロールは出さない', () => {
    const l = computeCabinetLayout(1200, 600)
    assert.equal(l.isLandscapeCompact, false)
    assert.equal(l.scale, 600 / CABINET_BASE_HEIGHT)
    assert.equal(l.needsScroll, false)
    assert.ok(l.stageHeight <= 600)
  })
})
