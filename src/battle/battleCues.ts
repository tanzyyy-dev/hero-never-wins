/**
 * BATTLE MODE 各G（1〜8G）のレバーON時に鳴らす演出SE・キャラクターVOICEの決定表。
 *
 * - 仕様: docs/battle-mode/battle-mode-basic-structure.md / ally-save-scenario.md
 * - 呼び出し元: src/main.tsx onLever（BATTLE MODE中のみ）
 * - 発音処理: src/se.ts playBattleSe / playVoiceSe
 * - テスト: src/battle/battle.test.ts（npm run test:battle）
 *
 * 8G終了後（肩叩き・復活・敗北・CONTINUE）の SE/VOICE は main.tsx onStop / resolveFalseDefeatChance 側で扱う。
 */
import type { BattlePattern } from '../engine.ts'
import type { BattleSeOptions, BattleSeType, SeKey } from '../se.ts'

export interface BattleLeverCue {
  /** 演出SE（同じGで再回転した場合は呼び出し側で鳴らさない） */
  seKey: BattleSeType | null
  /** 演出SEのオプション（3G〜5Gは攻撃側で音色を変える） */
  seOptions?: BattleSeOptions
  /** キャラクターVOICE（1バトル中に同じキーは1回のみ。重複判定は呼び出し側） */
  voiceKey: SeKey | null
}

export function resolveBattleLeverCue(battleGame: number, pattern: BattlePattern | null): BattleLeverCue {
  const isHeroFirst = pattern === 'hero_attack'
  const attackSide: BattleSeOptions['side'] = isHeroFirst ? 'hero' : 'boss'
  let seKey: BattleSeType | null = null
  let voiceKey: SeKey | null = null

  if (battleGame === 1) {
    seKey = 'standoff'
  } else if (battleGame === 2) {
    seKey = 'tension'
  } else if (battleGame === 3) {
    voiceKey = isHeroFirst ? 'voice_hero_provocation' : 'voice_boss_provocation'
    seKey = 'cut_in'
  } else if (battleGame === 4) {
    voiceKey = isHeroFirst ? 'voice_hero_special_attack' : 'voice_boss_spacial_attack'
    seKey = 'charge'
  } else if (battleGame === 5) {
    seKey = 'release'
  } else if (battleGame === 6) {
    if (pattern === 'ally_save') {
      voiceKey = 'voice_fellow'
      seKey = 'kai_arrive'
    } else {
      voiceKey = isHeroFirst ? 'voice_boss_damage' : 'voice_hero_damage'
      seKey = 'heavy_hit'
    }
  } else if (battleGame === 7) {
    seKey = pattern === 'ally_save' ? 'kai_parry' : 'endure'
  } else if (battleGame === 8) {
    seKey = pattern === 'ally_save' ? 'ally_afterglow' : 'endure_peak'
  }

  const seOptions = seKey && battleGame >= 3 && battleGame <= 5 ? { side: attackSide } : undefined
  return seOptions ? { seKey, seOptions, voiceKey } : { seKey, voiceKey }
}
