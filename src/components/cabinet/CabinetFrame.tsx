/**
 * 筐体フレームの静的パーツ（状態はランプモードのみ受け取る）。
 *
 * - CSS: src/style.css の各セクション（TOP ILLUMINATION CROWN / MOBILE PORTRAIT EXPANDED SIDE WINGS /
 *   BELLY GLASS PANEL / BOTTOM CABINET DECK）
 * - ランプ色: docs/cabinet-lamp-spec.md、モード決定は src/engine.ts resolveTopLampMode
 * - サイドフレーム・下部コンパクト化: docs/cabinet-responsive-layout.md
 */
import type { CSSProperties } from 'react'
import type { TopLampMode } from '../../engine'

/** 1. TOP ILLUMINATION CROWN（演出特化型・超ド派手トップランプユニット） */
export function TopCrown({ topLampMode }: { topLampMode: TopLampMode }) {
  return (
    <header className={`top-crown lamp-mode-${topLampMode}`}>
      <div className="crown-prism-wing wing-left">
        <span className="wing-prism-bar bar-1" />
        <span className="wing-prism-bar bar-2" />
        <span className="wing-prism-bar bar-3" />
      </div>

      <div className="crown-center-lamp-unit">
        <div className="lamp-brow-visor" />
        <div className="lamp-led-runner upper-runner" />

        <div className="lamp-prism-array">
          {[0, 1, 2, 3, 4].map((segIdx) => (
            <div key={segIdx} className={`lamp-segment seg-${segIdx}`}>
              <div className="segment-prism-facet" />
              <div className="segment-led-core" />
            </div>
          ))}

          <div className="lamp-center-shield" aria-hidden="true">
            <div className="shield-bezel" />
            <div className="shield-prism-facet" />
            <div className="shield-led-core" />
          </div>

          {[5, 6, 7, 8, 9].map((segIdx) => (
            <div key={segIdx} className={`lamp-segment seg-${segIdx}`}>
              <div className="segment-prism-facet" />
              <div className="segment-led-core" />
            </div>
          ))}
        </div>

        <div className="lamp-led-runner lower-runner" />
      </div>

      <div className="crown-prism-wing wing-right">
        <span className="wing-prism-bar bar-3" />
        <span className="wing-prism-bar bar-2" />
        <span className="wing-prism-bar bar-1" />
      </div>
    </header>
  )
}

/** スマホ縦画面の左右余白を埋める拡張サイドフレーム（LED は上下ランプと同期） */
export function CabinetSideWing({
  side,
  topLampMode,
  style,
}: {
  side: 'left' | 'right'
  topLampMode: TopLampMode
  style?: CSSProperties
}) {
  return (
    <div className={`cabinet-side-wing wing-${side}`} style={style} aria-hidden="true">
      <div className="wing-header-cap" />
      <div className="wing-frame-body">
        <span className="wing-rivet top" />
        <div className={`wing-led-strip mode-${topLampMode}`} />
        <span className="wing-rivet bottom" />
      </div>
      <div className="wing-footer-cap" />
    </div>
  )
}

/** 5. BELLY GLASS PANEL（下部アクリルパネルアート + スリット電飾バー） */
export function BellyGlassPanel({ topLampMode }: { topLampMode: TopLampMode }) {
  return (
    <section className="belly-glass-section">
      <div className="belly-glass-housing">
        {/* パネル両サイドのランプは演出性がある時は筐体上部の色・演出と完全同期 */}
        <div className={`side-led-bar left mode-${topLampMode}`} />
        <div className="belly-glass-window">
          <img
            src="/belly_glass_protagonist.jpg"
            alt="主人公なのにやけに勝てない。黒いジャケットに金の装飾とボルドーのスカーフを身に着けた主人公の筐体パネル"
            className="belly-art-img"
          />
          <div className="glass-reflection" />
        </div>
        <div className={`side-led-bar right mode-${topLampMode}`} />
      </div>
    </section>
  )
}

/** 6. BOTTOM CABINET DECK（左右縦型スピーカー & 中央固定受け皿ユニット & 前面リム） */
export function BottomCabinetDeck() {
  return (
    <footer className="bottom-cabinet-deck">
      <div className="bottom-unit-core">
        {/* 左：縦型スリムスピーカー */}
        <div className="bottom-speaker left-speaker" aria-hidden="true">
          <span className="speaker-mount-screw top" />
          <div className="speaker-mesh-grill">
            <div className="speaker-cone-shadow" />
            <div className="speaker-perforation" />
          </div>
          <span className="speaker-mount-screw bottom" />
        </div>

        {/* 中央：奥壁組み込み排出口モールド ＋ 立体下皿 (固定筐体) */}
        <div className="bottom-center-bay">
          <div className="medal-tray-unit" aria-hidden="true">
            <div className="tray-upper-surround" />

            <div className="tray-3d-basin">
              {/* 奥壁 + 組み込み排出口モールド */}
              <div className="tray-back-wall">
                <div className="tray-chute-recess">
                  <div className="tray-chute-baffle" />
                  <div className="tray-chute-throat" />
                  <div className="tray-chute-slide" />
                </div>
              </div>

              {/* 左右の傾斜側壁 */}
              <div className="tray-side-wall left" />
              <div className="tray-side-wall right" />

              {/* 下皿の底面 (溝・奥行き・立体陰影) */}
              <div className="tray-floor">
                <div className="tray-floor-grooves" />
                <div className="tray-floor-shadow" />
              </div>
            </div>

            {/* 手前に高く立ち上がる半透明スモークフロントパネル */}
            <div className="tray-protruding-lip">
              <span className="tray-lip-top-bevel" />
              <span className="tray-lip-scoop" />
            </div>
          </div>
        </div>

        {/* 右：縦型スリムスピーカー */}
        <div className="bottom-speaker right-speaker" aria-hidden="true">
          <span className="speaker-mount-screw top" />
          <div className="speaker-mesh-grill">
            <div className="speaker-cone-shadow" />
            <div className="speaker-perforation" />
          </div>
          <span className="speaker-mount-screw bottom" />
        </div>
      </div>

      {/* 最下部：薄型筐体前面リム */}
      <div className="tray-front-bezel">
        <span className="tray-rim-rivet left" />
        <span className="tray-logo-text">HERO NEVER WINS 2026</span>
        <span className="tray-rim-rivet right" />
      </div>
    </footer>
  )
}
