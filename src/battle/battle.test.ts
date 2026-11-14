/**
 * BATTLE MODE 演出仕様（8G／1攻防・基本14枚・ally_save / girl_revive）の不変条件テスト。
 * 仕様書: docs/battle-mode/*.md
 *
 * 実行: npm run test:battle
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { BATTLE_PART_GAMES } from '../engine.ts'
import type { BattlePattern, BattlePhase } from '../engine.ts'
import {
  ALLY_SAVE_IMAGES,
  BATTLE_BASE_IMAGES,
  REVIVE_CUTIN_IMAGE,
  resolveBattleArtwork,
  resolveLeverFx,
} from './battleArtwork.ts'
import { resolveBattleLeverCue } from './battleCues.ts'

const PATTERNS: readonly BattlePattern[] = ['hero_attack', 'ally_save', 'girl_revive', 'defeat']
const PHASES: readonly BattlePhase[] = [
  'fighting',
  'false_defeat',
  'revive_cutin',
  'ally_shoulder_tap',
  'victory_reveal',
  'defeat_reveal',
]
const GAMES = Array.from({ length: BATTLE_PART_GAMES }, (_, i) => i + 1)

const fightingSrc = (pattern: BattlePattern, g: number) => resolveBattleArtwork(pattern, g, 'fighting', false).src

describe('battle artwork: 画像アセット', () => {
  it('基本14枚・ally_save専用4枚が定義されている', () => {
    assert.equal(Object.keys(BATTLE_BASE_IMAGES).length, 14)
    assert.equal(new Set(Object.values(BATTLE_BASE_IMAGES)).size, 14)
    assert.equal(Object.keys(ALLY_SAVE_IMAGES).length, 4)
  })

  it('参照している画像ファイルが public/ に存在する', () => {
    const publicDir = fileURLToPath(new URL('../../public', import.meta.url))
    for (const src of [...Object.values(BATTLE_BASE_IMAGES), ...Object.values(ALLY_SAVE_IMAGES), REVIVE_CUTIN_IMAGE]) {
      assert.ok(existsSync(publicDir + src), `missing asset: public${src}`)
    }
  })

  it('全パターン×全G×全フェーズで基本14枚すべてが到達可能（未使用画像なし）', () => {
    const used = new Set<string>()
    for (const pattern of PATTERNS) {
      for (const g of GAMES) {
        for (const phase of PHASES) {
          for (const special of [false, true]) {
            used.add(resolveBattleArtwork(pattern, g, phase, special).src)
          }
        }
      }
    }
    for (const src of Object.values(BATTLE_BASE_IMAGES)) {
      assert.ok(used.has(src), `unreachable base image: ${src}`)
    }
  })
})

describe('battle artwork: 8G構成（基本仕様）', () => {
  it('1G・2Gは全ルート共通', () => {
    for (const pattern of PATTERNS) {
      assert.equal(fightingSrc(pattern, 1), BATTLE_BASE_IMAGES.g01Standoff)
      assert.equal(fightingSrc(pattern, 2), BATTLE_BASE_IMAGES.g02Tension)
    }
  })

  it('4Gと5G、7Gと8Gは同じ画像を共用する（ally_save の7G・8Gを除く）', () => {
    for (const pattern of PATTERNS) {
      assert.equal(fightingSrc(pattern, 4), fightingSrc(pattern, 5), `${pattern} 4G/5G`)
      if (pattern !== 'ally_save') {
        assert.equal(fightingSrc(pattern, 7), fightingSrc(pattern, 8), `${pattern} 7G/8G`)
      }
    }
  })

  it('主人公先制は主人公側の画像、7G・8Gは被弾した敵が耐える', () => {
    assert.equal(fightingSrc('hero_attack', 3), BATTLE_BASE_IMAGES.g03HeroFirst)
    assert.equal(fightingSrc('hero_attack', 4), BATTLE_BASE_IMAGES.g04_05HeroSpecial)
    assert.equal(fightingSrc('hero_attack', 6), BATTLE_BASE_IMAGES.g06HeroHits)
    assert.equal(fightingSrc('hero_attack', 7), BATTLE_BASE_IMAGES.g07_08EnemyEndures)
  })

  it('主人公先制の通常終了は「敵が立ち上がる」。敵撃破は特別終了（isSpecialEnemyDefeat）のみ', () => {
    assert.equal(
      resolveBattleArtwork('hero_attack', 8, 'victory_reveal', false).src,
      BATTLE_BASE_IMAGES.resultEnemyRises
    )
    assert.equal(
      resolveBattleArtwork('hero_attack', 8, 'defeat_reveal', true).src,
      BATTLE_BASE_IMAGES.resultEnemyFalls
    )
    for (const pattern of PATTERNS) {
      for (const phase of PHASES) {
        if (pattern === 'hero_attack' && phase === 'defeat_reveal') continue
        assert.notEqual(
          resolveBattleArtwork(pattern, 8, phase, false).src,
          BATTLE_BASE_IMAGES.resultEnemyFalls,
          `${pattern}/${phase} must not show enemy falls`
        )
      }
    }
  })
})

describe('battle artwork: シナリオ別仕様', () => {
  it('ally_save: 1〜5Gは敵先制の基本画像、6G〜8G・肩叩きは専用画像', () => {
    for (const g of [1, 2, 3, 4, 5]) {
      assert.equal(fightingSrc('ally_save', g), fightingSrc('defeat', g), `${g}G`)
    }
    assert.equal(fightingSrc('ally_save', 6), ALLY_SAVE_IMAGES.g06KaiArrives)
    assert.equal(fightingSrc('ally_save', 7), ALLY_SAVE_IMAGES.g07KaiParries)
    assert.equal(fightingSrc('ally_save', 8), ALLY_SAVE_IMAGES.g08TrioAfterglow)
    assert.equal(
      resolveBattleArtwork('ally_save', 8, 'ally_shoulder_tap', false).src,
      ALLY_SAVE_IMAGES.resultKaiShoulderTap
    )
  })

  it('girl_revive: CHANCE入力前は敗北（defeat）と見分けがつかない', () => {
    for (const g of GAMES) {
      assert.equal(fightingSrc('girl_revive', g), fightingSrc('defeat', g), `${g}G`)
    }
    assert.equal(
      resolveBattleArtwork('girl_revive', 8, 'false_defeat', false).src,
      resolveBattleArtwork('defeat', 8, 'false_defeat', false).src
    )
    assert.equal(resolveBattleArtwork('girl_revive', 8, 'false_defeat', false).src, BATTLE_BASE_IMAGES.resultHeroFalls)
  })

  it('girl_revive: 復活カットイン → 主人公が立ち上がる', () => {
    assert.equal(resolveBattleArtwork('girl_revive', 8, 'revive_cutin', false).src, REVIVE_CUTIN_IMAGE)
    assert.equal(
      resolveBattleArtwork('girl_revive', 8, 'victory_reveal', false).src,
      BATTLE_BASE_IMAGES.resultHeroRises
    )
  })
})

describe('battle lever FX / SE / VOICE cues', () => {
  it('girl_revive は全Gで defeat と同じ SE・VOICE・エフェクト（復活を事前に示唆しない）', () => {
    for (const g of GAMES) {
      assert.deepEqual(resolveBattleLeverCue(g, 'girl_revive'), resolveBattleLeverCue(g, 'defeat'), `${g}G cue`)
      assert.equal(resolveLeverFx('girl_revive', g), resolveLeverFx('defeat', g), `${g}G fx`)
    }
  })

  it('ally_save は1〜5Gが敵先制と同じで、6G カイ登場 / 7G 受け流し / 8G 余韻', () => {
    for (const g of [1, 2, 3, 4, 5]) {
      assert.deepEqual(resolveBattleLeverCue(g, 'ally_save'), resolveBattleLeverCue(g, 'defeat'), `${g}G`)
    }
    assert.deepEqual(resolveBattleLeverCue(6, 'ally_save'), { seKey: 'kai_arrive', voiceKey: 'voice_fellow' })
    assert.deepEqual(resolveBattleLeverCue(7, 'ally_save'), { seKey: 'kai_parry', voiceKey: null })
    assert.deepEqual(resolveBattleLeverCue(8, 'ally_save'), { seKey: 'ally_afterglow', voiceKey: null })
    for (const g of [6, 7, 8]) {
      assert.equal(resolveLeverFx('ally_save', g), null, `${g}G: 画像にない攻撃エフェクトを追加しない`)
    }
  })

  it('3G〜5Gのみ攻撃側（主人公/敵）で音色を分ける', () => {
    for (const g of GAMES) {
      const hero = resolveBattleLeverCue(g, 'hero_attack')
      const boss = resolveBattleLeverCue(g, 'defeat')
      if (g >= 3 && g <= 5) {
        assert.deepEqual(hero.seOptions, { side: 'hero' })
        assert.deepEqual(boss.seOptions, { side: 'boss' })
      } else {
        assert.equal(hero.seOptions, undefined)
        assert.equal(boss.seOptions, undefined)
      }
    }
  })

  it('主人公先制は主人公の挑発・必殺技 VOICE、6Gは被弾した敵の VOICE', () => {
    assert.equal(resolveBattleLeverCue(3, 'hero_attack').voiceKey, 'voice_hero_provocation')
    assert.equal(resolveBattleLeverCue(4, 'hero_attack').voiceKey, 'voice_hero_special_attack')
    assert.equal(resolveBattleLeverCue(6, 'hero_attack').voiceKey, 'voice_boss_damage')
    assert.equal(resolveBattleLeverCue(6, 'defeat').voiceKey, 'voice_hero_damage')
  })

  it('全Gで演出SEが割り当てられている', () => {
    for (const pattern of PATTERNS) {
      for (const g of GAMES) {
        assert.notEqual(resolveBattleLeverCue(g, pattern).seKey, null, `${pattern} ${g}G`)
      }
    }
  })
})
