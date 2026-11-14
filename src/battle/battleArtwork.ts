/**
 * BATTLE MODE の「どのG・フェーズで何を表示するか」を決める純粋関数群。
 *
 * - 仕様: docs/battle-mode/battle-mode-basic-structure.md（基本14枚・8G構成）
 *         docs/battle-mode/ally-save-scenario.md（カイ援軍専用4枚）
 *         docs/battle-mode/girl-revive-scenario.md（セリーヌ復活）
 * - テスト: src/battle/battle.test.ts（npm run test:battle）
 * - 表示側: src/components/BattleSceneDisplay.tsx
 *
 * ※ 8G構成・攻防順序・画像の役割はオーナー合意なしに変更しないこと（AGENTS.md）。
 */
import type { BattlePattern, BattlePhase } from '../engine.ts'

/**
 * BATTLE MODE 基本14枚画像マッピング（docs/battle-mode/battle-mode-basic-structure.md 準拠）
 */
export const BATTLE_BASE_IMAGES = {
  g01Standoff: 'battle_base_g01_standoff.webp',
  g02Tension: 'battle_base_g02_tension.webp',
  g03HeroFirst: 'battle_base_g03_hero_first.webp',
  g03EnemyFirst: 'battle_base_g03_enemy_first.webp',
  g04_05HeroSpecial: 'battle_base_g04_05_hero_special.webp',
  g04_05EnemySpecial: 'battle_base_g04_05_enemy_special.webp',
  g06HeroHits: 'battle_base_g06_hero_hits.webp',
  g06EnemyHits: 'battle_base_g06_enemy_hits.webp',
  g07_08HeroEndures: 'battle_base_g07_08_hero_endures.webp',
  g07_08EnemyEndures: 'battle_base_g07_08_enemy_endures.webp',
  resultHeroRises: 'battle_base_result_hero_rises.webp',
  resultHeroFalls: 'battle_base_result_hero_falls.webp',
  resultEnemyRises: 'battle_base_result_enemy_rises.webp',
  resultEnemyFalls: 'battle_base_result_enemy_falls.webp',
} as const

/** セリーヌ復活演出（既存画像を流用） */
export const REVIVE_CUTIN_IMAGE = 'battle_girl_revive.jpg'

/**
 * ally_save（カイ援軍）専用画像4枚（docs/battle-mode/ally-save-scenario.md 準拠）
 */
export const ALLY_SAVE_IMAGES = {
  g06KaiArrives: 'battle_ally_g06_kai_arrives.webp',
  g07KaiParries: 'battle_ally_g07_kai_parries.webp',
  g08TrioAfterglow: 'battle_ally_g08_trio_afterglow.webp',
  resultKaiShoulderTap: 'battle_ally_result_kai_shoulder_tap.webp',
} as const

/**
 * レバーON時（SE発音と同時）に一度だけ再生するエフェクトの種類
 * ※画像に描かれていない攻撃・反撃は追加しない。各Gの意味（対峙／先制／溜め／解放／命中／耐える）を強調するのみ
 */
export type LeverFxKind = 'tension' | 'cutin' | 'charge' | 'release' | 'impact' | 'endure' | 'endure_peak'

export function resolveLeverFx(pattern: BattlePattern, battleGame: number): LeverFxKind | null {
  switch (battleGame) {
    case 2:
      return 'tension'
    case 3:
      return 'cutin'
    case 4:
      return 'charge'
    case 5:
      return 'release'
    case 6:
      return pattern === 'ally_save' ? null : 'impact'
    case 7:
      return pattern === 'ally_save' ? null : 'endure'
    case 8:
      return pattern === 'ally_save' ? null : 'endure_peak'
    default:
      return null
  }
}

/** 6G命中SEの「吸い込み」と同じ長さのヒットストップ（ms） */
export const HITSTOP_MS = 90

export interface BattleArtwork {
  src: string
  cameraClass: string
}

/**
 * 8G／1攻防＋結果告知の静止画とカメラワーク（軽微なズーム）を決定する
 */
export function resolveBattleArtwork(
  pattern: BattlePattern,
  battleGame: number,
  battlePhase: BattlePhase,
  isSpecialEnemyDefeat: boolean
): BattleArtwork {
  const isHeroFirst = pattern === 'hero_attack'

  if (battlePhase === 'revive_cutin') {
    return { src: REVIVE_CUTIN_IMAGE, cameraClass: 'cam-revive-zoom' }
  }
  if (battlePhase === 'ally_shoulder_tap') {
    return { src: ALLY_SAVE_IMAGES.resultKaiShoulderTap, cameraClass: 'cam-ally-shoulder-tap' }
  }
  if (battlePhase === 'false_defeat') {
    return { src: BATTLE_BASE_IMAGES.resultHeroFalls, cameraClass: 'cam-despair' }
  }
  if (battlePhase === 'defeat_reveal') {
    if (isHeroFirst && isSpecialEnemyDefeat) {
      return { src: BATTLE_BASE_IMAGES.resultEnemyFalls, cameraClass: 'cam-despair' }
    }
    return { src: BATTLE_BASE_IMAGES.resultHeroFalls, cameraClass: 'cam-despair' }
  }
  if (battlePhase === 'victory_reveal') {
    if (pattern === 'ally_save') {
      return { src: ALLY_SAVE_IMAGES.resultKaiShoulderTap, cameraClass: 'cam-victory-burst' }
    }
    return {
      src: isHeroFirst ? BATTLE_BASE_IMAGES.resultEnemyRises : BATTLE_BASE_IMAGES.resultHeroRises,
      cameraClass: 'cam-victory-burst',
    }
  }

  const game = Math.min(8, Math.max(1, battleGame))

  // 1G・2G: 全ルート共通
  if (game === 1) {
    return { src: BATTLE_BASE_IMAGES.g01Standoff, cameraClass: 'cam-standoff-wide' }
  }
  if (game === 2) {
    return { src: BATTLE_BASE_IMAGES.g02Tension, cameraClass: 'cam-standoff-tight' }
  }

  // 3G: 先制者分岐
  if (game === 3) {
    return isHeroFirst
      ? { src: BATTLE_BASE_IMAGES.g03HeroFirst, cameraClass: 'cam-surge-hero' }
      : { src: BATTLE_BASE_IMAGES.g03EnemyFirst, cameraClass: 'cam-surge-boss' }
  }

  // 4G・5G: 同じ必殺技画像を共用（前半・後半で画角とエフェクトのみ分ける）
  if (game === 4) {
    return isHeroFirst
      ? { src: BATTLE_BASE_IMAGES.g04_05HeroSpecial, cameraClass: 'cam-special-charge' }
      : { src: BATTLE_BASE_IMAGES.g04_05EnemySpecial, cameraClass: 'cam-special-charge' }
  }
  if (game === 5) {
    return isHeroFirst
      ? { src: BATTLE_BASE_IMAGES.g04_05HeroSpecial, cameraClass: 'cam-special-release' }
      : { src: BATTLE_BASE_IMAGES.g04_05EnemySpecial, cameraClass: 'cam-special-release' }
  }

  // 6G: 必殺技命中（ally_saveのみカイ登場へ分岐）
  if (game === 6) {
    if (pattern === 'ally_save') {
      return { src: ALLY_SAVE_IMAGES.g06KaiArrives, cameraClass: 'cam-kai-arrives' }
    }
    return isHeroFirst
      ? { src: BATTLE_BASE_IMAGES.g06HeroHits, cameraClass: 'cam-impact-hit' }
      : { src: BATTLE_BASE_IMAGES.g06EnemyHits, cameraClass: 'cam-impact-hit' }
  }

  // 7G・8G: 被弾側が耐える（ally_saveのみ7Gカイ受け流し・8G三者の余韻へ分岐）
  if (pattern === 'ally_save') {
    return game === 7
      ? { src: ALLY_SAVE_IMAGES.g07KaiParries, cameraClass: 'cam-kai-parry' }
      : { src: ALLY_SAVE_IMAGES.g08TrioAfterglow, cameraClass: 'cam-trio-afterglow' }
  }

  const endureSrc = isHeroFirst
    ? BATTLE_BASE_IMAGES.g07_08EnemyEndures
    : BATTLE_BASE_IMAGES.g07_08HeroEndures
  return {
    src: endureSrc,
    cameraClass: game === 7 ? 'cam-endure-first' : 'cam-endure-hold',
  }
}
