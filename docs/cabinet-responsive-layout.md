# スマホ縦画面 筐体レイアウト・余白ゼロ表示仕様

## 目的

スマートフォン実機・各種モバイルブラウザ（Safari / Chrome / PWA 等）におけるアドレスバー・ボトムバーの有無やアスペクト比の違いを問わず、**縦横スクロールを出さずに 1 画面へ筐体を収め、左右の黒余白を生じさせない**ためのレスポンシブ仕様です。

## 基本方針（変更不可ルール）

1. **筐体コアの比率維持**
   - 中央の筐体コア（`.pachislot-cabinet`、基準幅 `440px`）内部の液晶・リール・操作ボタンの横幅比率は歪めない。
   - 端末幅に合わせて `scale`（`vw / 440` 基準、または高さ制限時の縮小率）でスケーリングする。

2. **縦寸不足時の下部コンパクト化（`bottom-compact`）**
   - スマホ縦画面（`vw <= 767px` かつ横画面コンパクト以外）で有効論理高さが `840px` 未満になる場合、`.pachislot-cabinet` に `bottom-compact` クラスを付与する。
   - `bottom-compact` 時は **`.bottom-unit-core`（左右スピーカー・メダル排出口・受け皿）を非表示** にし、下パネル（`.belly-glass-section`）の直下に最下部の薄い英語タイトル入りリム（`.tray-front-bezel`: `HERO NEVER WINS 2026`）を配置する。
   - さらなる縦寸不足時は `.belly-glass-section` を `min-height: 48px` まで縮小して吸収する（最小基準高さ `680px`。これを下回る場合は筐体全体を縮小し、縮小率の下限は `0.52`）。
   - 逆に有効論理高さが `840px` 以上の縦長端末では、筐体の論理高さを最大 `932px` まで伸ばし、下パネル（`.belly-glass-section`、最大 `190px`）で縦寸を吸収する。

3. **左右余白の拡張サイドフレーム＋連動電装（`.cabinet-side-wing`）**
   - スマホ縦画面で縦寸制限などにより `stageWidth < vw` となり左右に余白（`sideSpace > 0`）が生じた場合、筐体左右に `.cabinet-side-wing`（`wing-left` / `wing-right`）を展開し、画面端まで隙間なく埋める。
   - サイドフレーム内にはメタリックベゼル・リベット・`topLampMode`（`ready` / `lever` / `spin` / `payout` / `payout-replay` / `payout-cherry` / `payout-melon` / `battle` / `rainbow`）に完全同期する縦型スリット LED 電装（`.wing-led-strip`）を配置し、筐体との一体感と視認性を保つ。

4. **スクロール抑止とセーフエリア**
   - スマホ縦画面時は `html.mobile-portrait-lock` および `.cabinet-wrapper.mobile-portrait` に対して `height: 100dvh; overflow: hidden; overscroll-behavior: none;` を適用し、縦横スクロールおよびバウンスを抑止する。
   - レイアウト計算は `.cabinet-wrapper` の `env(safe-area-inset-*)` を差し引いた実効クライアント領域（および `visualViewport` / `ResizeObserver`）を基準に行う。

5. **PC・タブレットおよび横画面の維持**
   - PC・タブレット（`vw >= 768px`）は従来通り中央配置を維持する（縮小率の下限は `0.62`。それでも縦に収まらない場合のみ `.cabinet-wrapper.scroll-fallback` でスクロールを許可する）。
   - 開発サーバー（`import.meta.env.DEV`）では `sideSpace >= 276px` のとき左右にデバッグパネルを表示する（本番ビルドでは表示しない）。
   - スマホ横画面（`vw > vh` かつ `vh <= 550px`。CSS は `@media (orientation: landscape) and (max-height: 550px)`）の 2 カラム構成はそのまま維持する。

## 主な実装箇所

- レイアウト計算・サイドフレーム描画: `src/main.tsx`（`computeCabinetLayout`, `wrapperRef`, `.cabinet-side-wing`）
- 縦横ロック・コンパクト化・サイド電装スタイル: `src/style.css`（`html.mobile-portrait-lock`, `.cabinet-side-wing`, `.pachislot-cabinet.bottom-compact`）
