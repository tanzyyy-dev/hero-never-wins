/**
 * 押し順ナビ（雑魚戦・BATTLE MODE）の判定と表示用の純粋関数。
 *
 * ルール（README「現在の仕様」と同じ）:
 * - リプレイは押し順不問・ナビ非表示
 * - 雑魚戦（通常時）のベルは第1〜第3停止すべて押し順通りでないと取りこぼし
 * - BATTLE MODE 中のベルは第1停止のみ正解すればよい（第2・第3停止は順不同・ナビも第1停止のみ表示）
 * - ボーナス揃え（bonusSpin）は左→中→右の順押しを案内
 *
 * - 呼び出し元: src/main.tsx onStop / オートプレイ / どこでもタップ / キーボード / 右側ナビランプ描画
 * - テスト: src/game/game.test.ts（npm run test:game）
 */
import type { NaviNumbers, NaviOrder, Scene, SpinOutcome } from '../engine.ts'

export type ReelIndex = 0 | 1 | 2
export type ReelFlags = readonly [boolean, boolean, boolean]

/**
 * 自動停止（オート・どこでもタップ・Space/Enter）で次に止めるリールを返す。
 * 押し順ナビの次の対象が未停止ならそれを、そうでなければ左から最初の未停止リールを返す。全停止済みなら -1。
 */
export function pickNaviStopReel(naviOrder: NaviOrder, naviStep: number, stopped: ReelFlags): number {
  const preferred = naviOrder[naviStep]
  const targetReel =
    preferred !== undefined && !stopped[preferred] ? preferred : stopped.findIndex((s) => !s)
  if (targetReel === -1 || stopped[targetReel]) return -1
  return targetReel
}

/** ボーナス揃え（bonusSpin）中に次に止めるリール（左から順）。全停止済みなら -1 */
export function pickBonusStopReel(stopped: ReelFlags): number {
  return stopped.findIndex((s) => !s)
}

/**
 * 今回の停止で押し順ミスになるか（ベル以外・リプレイは常に false）。
 * @param stopCount この停止より前に停止済みのリール数（0 = 第1停止）
 */
export function isNaviMissOnStop(params: {
  target: Pick<SpinOutcome, 'symbol' | 'isReplay'>
  isBattleMode: boolean
  stopCount: number
  reelIndex: number
  naviOrder: NaviOrder
}): boolean {
  const { target, isBattleMode, stopCount, reelIndex, naviOrder } = params
  if (target.symbol !== 'bell' || target.isReplay) return false
  if (isBattleMode) {
    return stopCount === 0 && reelIndex !== naviOrder[0]
  }
  return reelIndex !== naviOrder[stopCount]
}

export interface NaviDisplayContext {
  scene: Scene
  spin: Pick<SpinOutcome, 'symbol' | 'isReplay'> | null
  stopped: ReelFlags
  isBattleMode: boolean
  naviOrder: NaviOrder
  naviNumbers: NaviNumbers
  naviStep: number
}

export type NaviSegmentState = 'target' | 'wait' | 'idle'

export interface NaviReelDisplay {
  /** リール強調枠・STOPボタン強調の対象か */
  isTarget: boolean
  /** 右側ナビランプのセグメント状態（CSS クラス名） */
  segment: NaviSegmentState
  /** 右側ナビランプに表示する番号 */
  num: string | number
}

/** リール1本ぶんの押し順ナビ表示状態を求める */
export function resolveNaviReelDisplay(ctx: NaviDisplayContext, idx: number): NaviReelDisplay {
  const { scene, spin, stopped, isBattleMode, naviOrder, naviNumbers, naviStep } = ctx

  if (scene === 'bonusSpin') {
    const nextBonusReel = pickBonusStopReel(stopped)
    const isTarget = !stopped[idx] && nextBonusReel === idx
    return {
      isTarget,
      segment: stopped[idx] ? 'idle' : isTarget ? 'target' : 'wait',
      num: idx + 1,
    }
  }

  const isBellNaviActive = scene === 'spinning' && spin !== null && spin.symbol === 'bell' && !spin.isReplay
  if (!isBellNaviActive) {
    return { isTarget: false, segment: 'idle', num: '-' }
  }

  if (isBattleMode) {
    const isFirstTarget = naviOrder[0] === idx
    const isTarget = !stopped[idx] && naviStep === 0 && isFirstTarget
    const segment: NaviSegmentState = stopped[idx]
      ? 'idle'
      : naviStep === 0
        ? isFirstTarget
          ? 'target'
          : 'wait'
        : 'idle'
    return { isTarget, segment, num: isFirstTarget ? 1 : '-' }
  }

  const isTarget = !stopped[idx] && naviOrder[naviStep] === idx
  return {
    isTarget,
    segment: stopped[idx] ? 'idle' : isTarget ? 'target' : 'wait',
    num: naviNumbers[idx] ?? '-',
  }
}
