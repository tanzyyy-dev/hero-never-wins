import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { BELL_PAYOUT, type NaviNumbers, type NaviOrder, type Scene, type SymbolId } from '../engine'
import { ReelSymbolSvg } from './ReelSymbolSvg'
import './ZakoNaviDisplay.css'

interface ZakoNaviDisplayProps {
  scene: Scene
  symbol: SymbolId | null
  isReplay: boolean
  naviNumbers: NaviNumbers
  naviOrder: NaviOrder
  naviStep: number
  stopped: [boolean, boolean, boolean]
  isNaviFailed: boolean
  bellCount: number
  totalMedals: number
  payout: number
  autoPlay?: boolean
  fastSpeed?: boolean
}

// 同じ正式デザインの兵士を3体配置し、位置・遠近・構えで個体を見分ける。
const ZAKO_CONFIGS = [
  { id: 0, label: '左兵士', defaultLeft: '18%', naviTop: '63%' },
  { id: 1, label: '中兵士', defaultLeft: '50%', naviTop: '63%' },
  { id: 2, label: '右兵士', defaultLeft: '82%', naviTop: '63%' },
] as const

export function ZakoNaviDisplay({
  scene,
  symbol,
  isReplay,
  naviNumbers,
  naviOrder,
  naviStep,
  stopped,
  isNaviFailed,
  bellCount,
  totalMedals,
  payout,
  autoPlay = false,
  fastSpeed = false,
}: ZakoNaviDisplayProps) {
  const getBannerRef = useRef<HTMLDivElement>(null)

  const isSpinning = scene === 'spinning'
  const allStopped = stopped[0] && stopped[1] && stopped[2]

  // ベル時のみ雑魚キャラ登場 (リプレイ・チェリー・スイカ・BAR・ハズレ時は背景疾走のみ)
  const isBellSpin = symbol === 'bell' && !isReplay
  const isCherrySpin = symbol === 'cherry' && !isReplay
  const isMelonSpin = symbol === 'melon' && !isReplay
  const isBarSpin = symbol === 'bar' && !isReplay
  // 雑魚全員撃破後の「12 GET」表示判定 (ベル成立時のみ)
  const showBellGet = isBellSpin && !isNaviFailed && (payout > 0 || allStopped) && scene !== 'lever'
  // 成功した最後の撃破もCSS演出を再生しきれるよう、GET表示中だけ舞台を残す。
  // ゲーム状態やシーン遷移は変更せず、次の更新またはアンマウント時に自然に破棄する。
  const showZako = isBellSpin && (isSpinning || !allStopped || showBellGet)
  // チェリー・スイカ・BAR成立時のTOTAL加算スライド表示
  const showCherryPayout = isCherrySpin && !isNaviFailed && payout > 0 && scene !== 'lever'
  const showMelonPayout = isMelonSpin && !isNaviFailed && payout > 0 && scene !== 'lever'
  const showBarPayout = isBarSpin && !isNaviFailed && payout > 0 && scene !== 'lever'

  // 現在押すべきナビ対象リール (0, 1, 2)
  const currentTargetReel = naviOrder[naviStep] !== undefined ? naviOrder[naviStep] : -1

  // 「12 GET」出現時のド迫力アニメーション
  useEffect(() => {
    if (!showBellGet || !getBannerRef.current) return

    const tween = gsap.fromTo(
      getBannerRef.current,
      { scale: 2.8, opacity: 0, filter: 'brightness(3) blur(6px)' },
      {
        scale: 1,
        opacity: 1,
        filter: 'brightness(1) blur(0px)',
        duration: 0.35,
        ease: 'power3.out',
      }
    )

    return () => {
      tween.kill()
    }
  }, [showBellGet])

  return (
    <div className="zako-navi-display-container">
      {/* 1. 背景は独立レイヤー。回転中だけ微細にパンして奥行きを出す */}
      <img
        className={`zako-arena-background ${isSpinning ? 'running-shake' : ''}`}
        src="battle_intro_arena.jpg"
        alt=""
        aria-hidden="true"
        draggable={false}
      />
      <div className="zako-arena-vignette" />
      <div className="zako-arena-floor-glow" />
      <div className="zako-arena-dust" />

      {/* 2. ベル成立時: 共通デザインの兵士3体と、個別の押し順ナビ */}
      {showZako && (
        <div className={`zako-stage-arena ${showBellGet ? 'final-hit-layer' : ''}`}>
          {ZAKO_CONFIGS.map((cfg) => {
            const idx = cfg.id
            const isDefeated = stopped[idx]
            const isCurrentTarget = currentTargetReel === idx && !isDefeated
            const orderPos = naviOrder.indexOf(idx as 0 | 1 | 2)
            const naviNum = naviNumbers[idx]

            // 前後関係の決定:
            // - 現在のターゲット: 最前面 (z-index: 30, scale: 1.08)
            // - 次のターゲット: 中間 (z-index: 20, scale: 0.95)
            // - 最後のターゲット: 奥 (z-index: 10, scale: 0.86)
            let depthClass = 'depth-back'
            if (isCurrentTarget) {
              depthClass = 'depth-front'
            } else if (orderPos > naviStep) {
              depthClass = orderPos === naviStep + 1 ? 'depth-mid' : 'depth-back'
            }

            return (
              <div
                key={idx}
                className={`zako-character-card soldier-${idx} ${depthClass} ${isDefeated ? 'defeated-strike' : ''
                  } ${isCurrentTarget ? 'active-target' : ''}`}
                style={{
                  left: cfg.defaultLeft,
                }}
              >
                <div className="zako-target-aura" aria-hidden="true" />
                <div className="zako-soldier-frame">
                  <img
                    src="mass_production_soldier.webp"
                    alt={`ヴォルグ軍団の${cfg.label}`}
                    className="zako-cutout-img"
                    draggable={false}
                  />
                </div>

                {/* 洗練された押し順ナビ演出:
                    - 胸の軍団シンボルを隠さないようベルト位置に表示
                    - 不透明な四角い板を全廃し、透明度のあるエナジーオーラを纏うクリスタルゴールド発光数字
                    - ターゲット時は「PUSH!」タグが一体となってリズミカルに脈動 */}
                {!isDefeated && (
                  <div
                    className={`zako-chest-navi ${isCurrentTarget ? 'target-active' : 'idle-navi'}`}
                    style={{ top: cfg.naviTop }}
                  >
                    <div className="navi-energy-aura" />
                    <span className="navi-crystal-num">{naviNum}</span>
                    {isCurrentTarget && (
                      <span className="navi-push-pill">PUSH!</span>
                    )}
                  </div>
                )}

                {/* 対象だけにヒットフラッシュ、衝撃波、火花、ノックバックを重ねる */}
                {isDefeated && (
                  <div className="zako-defeat-impact" aria-hidden="true">
                    <svg viewBox="0 0 220 180" preserveAspectRatio="none">
                      <circle className="impact-ring impact-ring-outer" cx="110" cy="88" r="35" />
                      <circle className="impact-ring impact-ring-inner" cx="110" cy="88" r="20" />
                      <path className="impact-slash" d="M8 112 83 76 58 105 194 42" />
                      <path className="impact-sparks" d="m46 46 18 18m-2 36-29 4m120-63-15 25m35 41-28-10m-64 30 7-23m41-67 5 20" />
                    </svg>
                    <span className="impact-flare" />
                    <span className="defeat-tag-text">撃破!</span>
                  </div>
                )}
              </div>
            )
          })}

          {/* 押し順ミス時の警告 */}
          {isNaviFailed && (
            <div className="navi-miss-alert-overlay">
              <span className="miss-warning-text">押し順ミス!!</span>
            </div>
          )}
        </div>
      )}

      {/* 3. 雑魚全員撃破後: 背景を少し暗くして中央に「12 GET」かっこよく表示 */}
      {showBellGet && (
        <div className="payout-8get-backdrop">
          <div ref={getBannerRef} className="payout-8get-banner">
            <div className="gold-text-shadow-layer">{BELL_PAYOUT} GET</div>
            <div className="gold-text-core-layer">{BELL_PAYOUT} GET</div>
            <div className="banner-sub-tag">BELL PAYOUT +{BELL_PAYOUT} COINS</div>
            <div className="gold-sparkle-shine" />
          </div>
        </div>
      )}

      {/* 4. リプレイ成立時示唆エフェクト (リール回転中) */}
      {isReplay && isSpinning && (
        <div className="replay-wind-overlay">
          <div className="replay-speed-lines" />
          <div className="replay-floating-symbol">
            <ReelSymbolSvg id="replay" className="replay-announcement-symbol" isCenter />
          </div>
        </div>
      )}

      {/* チェリー・スイカ・BAR成立時の TOTAL加算スライド演出 */}
      {showCherryPayout && (
        <div key={`cherry-${payout}-${totalMedals}`} className="battle-payout-flash">
          <span className="payout-plus-val cherry-pay">+{payout}</span>
        </div>
      )}
      {showMelonPayout && (
        <div key={`melon-${payout}-${totalMedals}`} className="battle-payout-flash">
          <span className="payout-plus-val melon-pay">+{payout}</span>
        </div>
      )}
      {showBarPayout && (
        <div key={`bar-${payout}-${totalMedals}`} className="battle-payout-flash">
          <span className="payout-plus-val bar-pay">+{payout}</span>
        </div>
      )}

      {/* 6. BELL / TOTAL 表示: 統一アーケードLCDスタイル (枠なし・8連クリスタルゲージ) */}
      <div className="raw-lcd-header-overlay">
        <div className="arcade-hud-group hud-left">
          <div className="raw-meter-text bell-meter">
            <span className="raw-label gold-label">BELL</span>
            <span className="raw-val gold-val">
              {bellCount}
              <span className="raw-val-sub">/8</span>
            </span>
          </div>
          <div className="bell-pip-gauge" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <span
                key={i}
                className={`bell-pip ${i < bellCount ? 'lit' : ''} ${i === bellCount - 1 ? 'latest' : ''}`}
              />
            ))}
          </div>
        </div>
        <div className="arcade-hud-group hud-right">
          <div className="raw-meter-text total-meter">
            <span className="raw-label cyan-label">TOTAL</span>
            <span className="raw-val cyan-val">{totalMedals}</span>
          </div>
        </div>
      </div>

      {/* 7. AUTO表示: ディスプレイエリア右下に枠なしテキストでゆっくり点滅 */}
      {autoPlay && (
        <div className="raw-lcd-auto-indicator">
          <span className={`auto-raw-text ${fastSpeed ? 'fast' : ''}`}>
            AUTO{fastSpeed ? ' 2x' : ''}
          </span>
        </div>
      )}

      {/* 液晶スキャンラインと光彩 */}
      <div className="zako-scanlines" />
      <div className="zako-glass-glare" />
    </div>
  )
}
