/**
 * 進行シーンから再生する BGM トラックを決める。
 *
 * - bonusSpin: なし（777が揃うまでは SE のみ）
 * - bonusGet: 'opening'（777揃い後の BONUS GET 演出）
 * - finished: 'gameover'（GAME OVER 後からリトライまで）
 * - BATTLE MODE 中・突入演出: 'battle'
 * - 雑魚戦・小役パート（ready / lever / spinning）: 'pre_battle'
 *
 * - 再生処理: src/bgm.ts useBgm（ファイル対応表 BGM_PATHS もそこ）
 * - テスト: src/game/game.test.ts（npm run test:game）
 */
import type { Scene } from '../engine.ts'
import type { BgmTrack } from '../bgm.ts'

export function resolveSceneBgmTrack(scene: Scene, isBattleMode: boolean): BgmTrack {
  if (scene === 'bonusSpin') return null
  if (scene === 'bonusGet') return 'opening'
  if (scene === 'finished') return 'gameover'
  if (isBattleMode || scene === 'battleModeIntro' || scene === 'battle' || scene === 'battleResult') {
    return 'battle'
  }
  return 'pre_battle'
}
