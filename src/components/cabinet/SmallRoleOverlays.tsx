/**
 * 小役成立時に液晶へ重ねるオーバーレイ演出（チェリー / スイカ / スイカストック / BARを狙え！）。
 * プレミアムBAR揃い演出は src/components/PremiumBarDisplay.tsx。
 *
 * - 表示タイミング（レバーON時の告知・全停止で消灯）: src/main.tsx onLever / onStop
 * - 発生抽選: src/engine.ts drawBarAimCutin / SpinOutcome.barAim
 * - CSS: src/style.css「Cherry Role Visual Effect」「BARを狙え！」「スイカ成立時エフェクト」セクション
 * - 親側で key を変えて再マウントし、アニメーションを毎回先頭から再生する
 */
import { ReelSymbolSvg } from '../ReelSymbolSvg'

/** チェリー成立時の液晶エフェクト（レバーON〜第3リール停止まで継続・ストック成否や種類による差異なし） */
export function CherryEffectOverlay() {
  return (
    <div className="cherry-effect-overlay" aria-hidden="true">
      <div className="cherry-flash-layer" />
      <div className="cherry-shockwave" />
      <div className="cherry-lightning-beams" />
      <div className="cherry-floating-symbol">
        <ReelSymbolSvg id="cherry" className="announcement-symbol-svg cherry-announcement-symbol" isCenter />
      </div>
    </div>
  )
}

/** スイカ成立時の液晶エフェクト（レバーON〜第3リール停止まで継続・ストック成否による差異なし） */
export function MelonEffectOverlay() {
  return (
    <div className="melon-effect-overlay" aria-hidden="true">
      <div className="melon-flash-layer" />
      <div className="melon-shockwave" />
      <div className="melon-lightning-beams" />
      <div className="melon-floating-symbol">
        <ReelSymbolSvg id="melon" className="announcement-symbol-svg melon-announcement-symbol" isCenter />
      </div>
    </div>
  )
}

/** スイカ＋ストック当選時の獲得告知 */
export function MelonStockBanner() {
  return (
    <div className="melon-stock-overlay" aria-hidden="true">
      <div className="melon-stock-badge">
        <span className="melon-stock-kicker">MELON GET!!</span>
        <span className="melon-stock-value">STOCK +1</span>
      </div>
    </div>
  )
}

/** 「BARを狙え！」カットイン（レバーON〜第3リール停止まで表示） */
export function BarAimCutinOverlay() {
  return (
    <div className="bar-aim-overlay" aria-hidden="true">
      <div className="bar-aim-bg-flare" />
      <div className="bar-aim-speed-lines" />
      <div className="bar-aim-cutin-band">
        <span className="bar-aim-kicker">CHANCE!!</span>
        <span className="bar-aim-main-text">BARを狙え！</span>
        <div className="bar-aim-symbols-row">
          <span className="bar-aim-mini-badge">BAR</span>
          <span className="bar-aim-mini-badge">BAR</span>
          <span className="bar-aim-mini-badge">BAR</span>
        </div>
      </div>
    </div>
  )
}
