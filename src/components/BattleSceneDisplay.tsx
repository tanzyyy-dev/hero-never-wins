import { useEffect, useState } from 'react'
import type { BattlePattern, BattlePhase, Scene, SymbolId } from '../engine'
import './BattleSceneDisplay.css'

export interface BattleSceneDisplayProps {
  round: number
  totalMedals: number
  pattern: BattlePattern
  battleGame: number // 1..8 (全8G)
  battlePhase: BattlePhase
  scene: Scene
  symbol?: SymbolId | null
  payout: number
  autoPlay: boolean
  fastSpeed: boolean
  /** 20ROUND OVER かつ GAME OVER 条件成立時の特別終了フラグ（将来接続用） */
  isSpecialEnemyDefeat?: boolean
  /** false_defeat 時に CHANCE 押下後のホワイトアウト演出を発火するフラグ */
  falseDefeatWhiteout?: boolean
  /** 現在の回転がこのGで初回のレバーONか（false=リプレイ等の再回転。G演出を繰り返さない） */
  leverFxArmed?: boolean
}

/**
 * BATTLE MODE 基本14枚画像マッピング（docs/battle-mode/battle-mode-basic-structure.md 準拠）
 */
const BATTLE_BASE_IMAGES = {
  g01Standoff: '/battle_base_g01_standoff.webp',
  g02Tension: '/battle_base_g02_tension.webp',
  g03HeroFirst: '/battle_base_g03_hero_first.webp',
  g03EnemyFirst: '/battle_base_g03_enemy_first.webp',
  g04_05HeroSpecial: '/battle_base_g04_05_hero_special.webp',
  g04_05EnemySpecial: '/battle_base_g04_05_enemy_special.webp',
  g06HeroHits: '/battle_base_g06_hero_hits.webp',
  g06EnemyHits: '/battle_base_g06_enemy_hits.webp',
  g07_08HeroEndures: '/battle_base_g07_08_hero_endures.webp',
  g07_08EnemyEndures: '/battle_base_g07_08_enemy_endures.webp',
  resultHeroRises: '/battle_base_result_hero_rises.webp',
  resultHeroFalls: '/battle_base_result_hero_falls.webp',
  resultEnemyRises: '/battle_base_result_enemy_rises.webp',
  resultEnemyFalls: '/battle_base_result_enemy_falls.webp',
} as const

/** セリーヌ復活演出（既存画像を流用） */
const REVIVE_CUTIN_IMAGE = '/battle_girl_revive.jpg'

/**
 * ally_save（カイ援軍）専用画像4枚（docs/battle-mode/ally-save-scenario.md 準拠）
 */
const ALLY_SAVE_IMAGES = {
  g06KaiArrives: '/battle_ally_g06_kai_arrives.webp',
  g07KaiParries: '/battle_ally_g07_kai_parries.webp',
  g08TrioAfterglow: '/battle_ally_g08_trio_afterglow.webp',
  resultKaiShoulderTap: '/battle_ally_result_kai_shoulder_tap.webp',
} as const

/**
 * レバーON時（SE発音と同時）に一度だけ再生するエフェクトの種類
 * ※画像に描かれていない攻撃・反撃は追加しない。各Gの意味（対峙／先制／溜め／解放／命中／耐える）を強調するのみ
 */
type LeverFxKind = 'tension' | 'cutin' | 'charge' | 'release' | 'impact' | 'endure' | 'endure_peak'

function resolveLeverFx(pattern: BattlePattern, battleGame: number): LeverFxKind | null {
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
const HITSTOP_MS = 90

/**
 * 8G／1攻防＋結果告知の静止画とカメラワーク（軽微なズーム）を決定する
 */
function resolveBattleArtwork(
  pattern: BattlePattern,
  battleGame: number,
  battlePhase: BattlePhase,
  isSpecialEnemyDefeat: boolean
): { src: string; cameraClass: string } {
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

export function BattleSceneDisplay({
  round,
  totalMedals,
  pattern,
  battleGame,
  battlePhase,
  scene,
  symbol = null,
  payout,
  autoPlay,
  fastSpeed,
  isSpecialEnemyDefeat = false,
  falseDefeatWhiteout = false,
  leverFxArmed = true,
}: BattleSceneDisplayProps) {
  const [screenShake, setScreenShake] = useState<'none' | 'light' | 'normal' | 'heavy'>('none')
  const [hitstopFreeze, setHitstopFreeze] = useState(false)
  const [leverFx, setLeverFx] = useState<{ kind: LeverFxKind; seq: number } | null>(null)
  const [screenFlash, setScreenFlash] = useState<'none' | 'white' | 'gold' | 'crimson'>('none')
  const [cutTransition, setCutTransition] = useState<'none' | 'sharp' | 'hitstop' | 'dark_fade' | 'gold_burst'>('none')
  const [transitionSeq, setTransitionSeq] = useState(0)

  // バトル突入時に基本14枚＋復活画像＋ally_save専用4枚を先行プリロードし、G切替のチラつきを防ぐ
  useEffect(() => {
    const urls = [
      ...Object.values(BATTLE_BASE_IMAGES),
      ...Object.values(ALLY_SAVE_IMAGES),
      REVIVE_CUTIN_IMAGE,
    ]
    urls.forEach((url) => {
      const img = new Image()
      img.src = url
    })
  }, [])

  const isHeroFirst = pattern === 'hero_attack'

  // 場面・G切替時の画面切り替えトランジション（ブツ切りをなくし、余韻とキレを演出）
  useEffect(() => {
    let nextType: 'none' | 'sharp' | 'hitstop' | 'dark_fade' | 'gold_burst' = 'none'
    let durationMs = 260

    if (battlePhase === 'false_defeat') {
      nextType = 'dark_fade'
      durationMs = 520
    } else if (battlePhase === 'revive_cutin') {
      nextType = 'gold_burst'
      durationMs = 460
    } else if (battlePhase === 'victory_reveal' || battlePhase === 'ally_shoulder_tap') {
      nextType = 'sharp'
      durationMs = 280
    } else if (battlePhase === 'fighting') {
      if (battleGame === 6 && pattern !== 'ally_save') {
        nextType = 'hitstop'
        durationMs = 280
      } else if (
        battleGame === 3 ||
        battleGame === 4 ||
        battleGame === 5 ||
        (pattern === 'ally_save' && (battleGame === 6 || battleGame === 7))
      ) {
        nextType = 'sharp'
        durationMs = 240
      }
    }

    if (nextType === 'none') {
      setCutTransition('none')
      return
    }

    setCutTransition(nextType)
    setTransitionSeq((s) => s + 1)
    const t = setTimeout(() => setCutTransition('none'), durationMs)
    return () => clearTimeout(t)
  }, [battleGame, battlePhase, pattern])

  // レバーON・フェーズ変化時のフラッシュ・画面揺れ・ヒットストップ風演出
  useEffect(() => {
    if (battlePhase === 'revive_cutin') {
      // 復活：金色ダブルストロボ＋重い揺れ（revive_fanfare の衝撃・鐘に同期）
      setScreenFlash('gold')
      setScreenShake('heavy')
      const timers = [
        setTimeout(() => setScreenFlash('none'), 200),
        setTimeout(() => setScreenFlash('gold'), 250),
        setTimeout(() => setScreenFlash('none'), 520),
        setTimeout(() => setScreenShake('none'), 600),
      ]
      return () => {
        timers.forEach(clearTimeout)
        setScreenShake('none')
      }
    }
    if (battlePhase === 'ally_shoulder_tap') {
      setScreenFlash('gold')
      const t = setTimeout(() => setScreenFlash('none'), 240)
      return () => clearTimeout(t)
    }
    if (battlePhase === 'victory_reveal') {
      setScreenFlash('white')
      const timers = [setTimeout(() => setScreenFlash('none'), 280)]
      if (pattern === 'hero_attack') {
        // 結果画を見せた後の遅延スラム（0.32s）に金フラッシュと揺れを合わせる
        timers.push(
          setTimeout(() => {
            setScreenFlash('gold')
            setScreenShake('normal')
          }, 320),
          setTimeout(() => setScreenFlash('none'), 560),
          setTimeout(() => setScreenShake('none'), 760)
        )
      }
      return () => {
        timers.forEach(clearTimeout)
        setScreenShake('none')
      }
    }
    if (scene === 'spinning' && battlePhase === 'fighting' && leverFxArmed) {
      if (battleGame === 4) {
        setScreenFlash(isHeroFirst ? 'gold' : 'crimson')
        const t1 = setTimeout(() => setScreenFlash('none'), 200)
        return () => clearTimeout(t1)
      }
      if (battleGame === 5) {
        // 解放SEの「キュイッ」→爆風（+100ms）に合わせて閃光と軽い揺れ
        const timers = [
          setTimeout(() => {
            setScreenFlash(isHeroFirst ? 'gold' : 'crimson')
            setScreenShake('light')
          }, 100),
          setTimeout(() => setScreenFlash('none'), 320),
          setTimeout(() => setScreenShake('none'), 420),
        ]
        return () => {
          timers.forEach(clearTimeout)
          setScreenShake('none')
        }
      }
      if (battleGame === 6) {
        if (pattern === 'ally_save') {
          setScreenFlash('gold')
          const t1 = setTimeout(() => setScreenFlash('none'), 220)
          return () => clearTimeout(t1)
        }
        // ヒットストップ：暗転フリーズ（SEの吸い込み）→ 命中の二段ストロボ＋重い揺れ
        setHitstopFreeze(true)
        const timers = [
          setTimeout(() => {
            setHitstopFreeze(false)
            setScreenFlash(isHeroFirst ? 'white' : 'crimson')
            setScreenShake('heavy')
          }, HITSTOP_MS),
          setTimeout(() => setScreenFlash('none'), HITSTOP_MS + 130),
          setTimeout(() => setScreenFlash(isHeroFirst ? 'gold' : 'white'), HITSTOP_MS + 190),
          setTimeout(() => setScreenFlash('none'), HITSTOP_MS + 330),
          setTimeout(() => setScreenShake('none'), HITSTOP_MS + 560),
        ]
        return () => {
          timers.forEach(clearTimeout)
          setHitstopFreeze(false)
          setScreenShake('none')
        }
      }
      if (battleGame === 7 && pattern === 'ally_save') {
        setScreenShake('normal')
        setScreenFlash('white')
        const t1 = setTimeout(() => setScreenShake('none'), 320)
        const t2 = setTimeout(() => setScreenFlash('none'), 200)
        return () => {
          clearTimeout(t1)
          clearTimeout(t2)
        }
      }
    }
  }, [scene, battleGame, battlePhase, isHeroFirst, pattern, leverFxArmed])

  // レバーON（SE発音と同時）で各Gのワンショットエフェクトを発火
  useEffect(() => {
    if (scene !== 'spinning' || battlePhase !== 'fighting' || !leverFxArmed) return
    const kind = resolveLeverFx(pattern, battleGame)
    if (!kind) return
    setLeverFx((prev) => ({ kind, seq: (prev?.seq ?? 0) + 1 }))
  }, [scene, battleGame, battlePhase, pattern, leverFxArmed])

  const activeLeverFx =
    leverFx && battlePhase === 'fighting' && resolveLeverFx(pattern, battleGame) === leverFx.kind ? leverFx : null
  const fxSide = isHeroFirst ? 'side-hero' : 'side-boss'

  const { src: artworkSrc, cameraClass } = resolveBattleArtwork(
    pattern,
    battleGame,
    battlePhase,
    isSpecialEnemyDefeat
  )

  const isDespairState =
    battlePhase === 'false_defeat' ||
    battlePhase === 'defeat_reveal' ||
    (battlePhase === 'fighting' && battleGame >= 7 && !isHeroFirst && pattern !== 'ally_save')

  const showSpeedLines =
    battlePhase === 'revive_cutin' ||
    battlePhase === 'victory_reveal' ||
    (battlePhase === 'fighting' &&
      (battleGame === 3 || battleGame === 4 || battleGame === 5 || (pattern === 'ally_save' && battleGame === 6)))

  const showParryShockwave = battlePhase === 'fighting' && battleGame === 7 && pattern === 'ally_save'
  const showChargeAura = battlePhase === 'fighting' && battleGame === 4
  const showReleaseFlare = battlePhase === 'fighting' && battleGame === 5
  const showEndureHeartbeat = battlePhase === 'fighting' && battleGame === 8 && pattern !== 'ally_save'

  return (
    <div
      className={`battle-scene-container ${screenShake !== 'none' ? `screen-shake shake-${screenShake}` : ''} ${
        isDespairState ? 'mood-despair' : ''
      } ${hitstopFreeze ? 'hitstop-freeze' : ''} phase-${battlePhase}`}
    >
      {/* 1. 基本14枚＋復活静止画ステージ */}
      <div className={`battle-artwork-stage ${cameraClass}`}>
        <img
          key={artworkSrc}
          src={artworkSrc}
          alt=""
          className="battle-artwork-img"
          draggable={false}
        />
      </div>

      {/* 2. 環境・衝撃エフェクト */}
      <div className="battle-atmosphere-layer">
        {isDespairState && <div className="despair-storm-vignette" />}
        {battlePhase === 'fighting' && battleGame <= 2 && <div className="arena-lightning-flash" />}
        {battlePhase === 'fighting' && battleGame <= 2 && (
          <>
            <div className="battle-letterbox top" />
            <div className="battle-letterbox bottom" />
          </>
        )}
        {showChargeAura && (
          <div className={`battle-charge-aura ${isHeroFirst ? 'hero-aura' : 'boss-aura'}`} />
        )}
        {showReleaseFlare && (
          <div className={`battle-release-flare ${isHeroFirst ? 'hero-flare' : 'boss-flare'}`} />
        )}
        {showEndureHeartbeat && <div className="battle-endure-heartbeat" />}
        {showSpeedLines && <div className="battle-speed-lines" />}
        {activeLeverFx && (
          <div key={activeLeverFx.seq} className={`battle-lever-fx fx-${activeLeverFx.kind} ${fxSide}`}>
            {activeLeverFx.kind === 'tension' && <div className="fx-pulse-vignette" />}
            {activeLeverFx.kind === 'cutin' && (
              <>
                <div className="fx-cutin-band" />
                <div className="fx-cutin-glint" />
              </>
            )}
            {activeLeverFx.kind === 'charge' && (
              <>
                <div className="fx-charge-ring" />
                <div className="fx-charge-ring ring-2" />
              </>
            )}
            {activeLeverFx.kind === 'release' && <div className="fx-release-burst" />}
            {activeLeverFx.kind === 'impact' && (
              <>
                <div className={`battle-hit-shockwave ${isHeroFirst ? 'hero-hit' : 'enemy-hit'}`} />
                <div className="fx-impact-rays" />
              </>
            )}
            {(activeLeverFx.kind === 'endure' || activeLeverFx.kind === 'endure_peak') && (
              <div className="fx-pulse-vignette" />
            )}
          </div>
        )}
        {showParryShockwave && <div className="battle-parry-shockwave" />}
        {battlePhase === 'revive_cutin' && <div className="revive-divine-rays" />}
        {battlePhase === 'victory_reveal' && <div className="victory-golden-aura" />}
      </div>

      {/* 3. 統一アーケードLCD HUD */}
      <div className="battle-raw-hud">
        <div className="arcade-hud-group hud-left">
          <div className="raw-meter-text">
            <span className="raw-label crimson-label">ROUND</span>
            <span className="raw-val gold-val">{round}</span>
          </div>
          <div className="battle-pip-gauge" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <span
                key={i}
                className={`battle-pip ${i < battleGame ? 'lit' : ''} ${
                  i === battleGame - 1 ? 'current' : ''
                }`}
              />
            ))}
          </div>
        </div>

        <div className="arcade-hud-group hud-right">
          <div className="raw-meter-text">
            <span className="raw-label cyan-label">TOTAL</span>
            <span className="raw-val cyan-val">{totalMedals}</span>
          </div>
        </div>
      </div>

      {/* 4. 主人公敗退ピンチ時の「CHANCEボタンを押せ！！」プロンプト */}
      {battlePhase === 'false_defeat' && !falseDefeatWhiteout && (
        <div className="chance-push-prompt-overlay" aria-live="polite">
          <div className="chance-push-prompt-box">
            <div className="chance-push-badge">CHANCE</div>
            <div className="chance-push-text">CHANCEボタンを押せ!!</div>
          </div>
        </div>
      )}

      {/* 4b. 復活・継続 / 敗北 クライマックスエンブレム */}
      {battlePhase === 'victory_reveal' && (
        <div className="climax-emblem-overlay">
          <div className={`victory-burst-rays ${pattern === 'hero_attack' ? 'delayed' : ''}`} />
          <div className={`climax-emblem victory-emblem ${pattern === 'hero_attack' ? 'delayed-slam' : ''}`}>
            {pattern === 'girl_revive' && <div className="emblem-kicker">REVIVAL</div>}
            <div className="emblem-main gold-metallic">CONTINUE</div>
          </div>
        </div>
      )}

      {battlePhase === 'defeat_reveal' && (
        <div className="climax-emblem-overlay">
          <div className="climax-emblem defeat-emblem">
            <div className="emblem-main silver-metallic">BATTLE END</div>
            <div className="emblem-stats-row">
              <span className="stat-item">
                <span className="stat-lbl">ROUND</span>
                <span className="stat-num">{round}</span>
              </span>
              <span className="stat-item">
                <span className="stat-lbl">TOTAL</span>
                <span className="stat-num cyan">{totalMedals}</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5. 払出し (+12 / +8 / +15) */}
      {payout > 0 && battlePhase === 'fighting' && (
        <div key={`${payout}-${totalMedals}`} className="battle-payout-flash">
          <span
            className={`payout-plus-val ${
              symbol === 'cherry'
                ? 'cherry-pay'
                : symbol === 'melon'
                  ? 'melon-pay'
                  : symbol === 'bar'
                    ? 'bar-pay'
                    : ''
            }`}
          >
            +{payout}
          </span>
        </div>
      )}

      {/* 6. AUTO表示 */}
      {autoPlay && (
        <div className="raw-lcd-auto-indicator">
          <span className={`auto-raw-text ${fastSpeed ? 'fast' : ''}`}>
            AUTO{fastSpeed ? ' 2x' : ''}
          </span>
        </div>
      )}

      {/* 7. 液晶走査線・ガラスグレア・場面切替トランジション・インパクトフラッシュ */}
      <div className="zako-scanlines" />
      <div className="zako-glass-glare" />
      {cutTransition !== 'none' && (
        <div key={transitionSeq} className={`battle-cut-transition trans-${cutTransition}`} />
      )}
      {falseDefeatWhiteout && <div className="battle-whiteout-overlay" />}
      {screenFlash !== 'none' && <div className={`battle-flash-layer flash-${screenFlash}`} />}
    </div>
  )
}
