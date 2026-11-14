# 主人公なのにやけに勝てない (hero-never-wins)

見た目は最強、実力は最弱。常に他力本願な筋肉主人公が、仲間の助けでなぜか継続する、オリジナルのバトルボーナス特化型ブラウザゲームです。

## 起動

Node.js 20.19+ または 22.12+ 推奨。

```bash
npm install
npm run dev
```

Vite が表示したURLをブラウザで開いてください。スマホの実機検証には、同じWi-FiでPCのLAN IPにアクセスするか、安全な開発用トンネルを利用してください。

```bash
npm run typecheck
npm test            # 全テスト（node --test、Node.js 22.18+ / 23.6+ が必要）
npm run check       # 型チェック + 全テスト
npm run build
```

機能単位のテスト: `npm run test:engine`（抽選・払出し）/ `test:battle`（BATTLE MODE 画像・SE/VOICE 仕様）/ `test:game`（押し順ナビ・BGM・デバッグ指定）/ `test:layout`（筐体レスポンシブ）。

## MVP の遊び方

- **どこでもタップ操作（推奨）**:
  画面のどこをタップ・クリックしても、場面に応じて「BET ➔ LEVER ON ➔ 第1停止 ➔ 第2停止 ➔ 第3停止」などの次の操作が順序よく自動進行します（リール停止は押し順ナビに従います）。スマホ片手の親指タップでテンポよくプレイできます。
- **物理ボタン操作**:
  MAX BETボタン、スタートレバー、各STOPボタン（1・2・3）、CHANCEボタンを個別にタップして操作することも可能です。
- **キーボード操作**:
  Space / Enter で進行、1 / 2 / 3 で各リール停止、C で CHANCE ボタン、M でミュート切替、S で設定画面の開閉ができます。
- マウス操作は左クリックのみ有効です（右クリック・中クリック・ピンチ操作などは無効化しています）。

停止タイミングによる目押し要素はなく、LEVER ON 時点で小役抽選が確定します。

## 現在の仕様

- **ゲームの流れ**: 777揃い（BONUS確定）➔ BONUS GET ➔ 雑魚戦（小役ゲーム）でベルを8回獲得 ➔ BATTLE MODE（全8Gで1つの攻防）➔ 継続なら次ROUND、敗北なら GAME OVER
- **設定1〜6**: セッション開始時に重み付きランダムで設定を抽選します（液晶上は「？」表示、GAME OVER画面で判明）。設定ごとのバトル継続率は 50% / 60% / 68% / 76% / 83% / 89%
- **小役**: ベル（12枚）・リプレイ（再遊技）・チェリー（8枚、単／2連／3連）・スイカ（8枚）・プレミアムBAR（15枚、1/65536）。BET は3枚、クレジット上限50枚。ベルは押し順ナビ（全6通り）に従わないと払い出しなし（雑魚戦は3つすべて、BATTLE MODE中は第1停止のみ正解が必要）
- **ストック**: チェリー・スイカ・プレミアムBAR（20個）で獲得。敗北当選時に1個消費して継続に救済
- **バトル演出**: 継続時は「主人公先制（10%）」「カイ援軍（45%）」「セリーヌ復活（45%）」、非継続時は「敗北」を出し分け。詳細は [BATTLE MODE 基本演出仕様](docs/battle-mode/battle-mode-basic-structure.md) , [カイ援軍シナリオ仕様](docs/battle-mode/ally-save-scenario.md), [セリーヌ復活シナリオ仕様](docs/battle-mode/girl-revive-scenario.md) を参照
- 小役の図柄・配当・確率・設定値は `src/engine.ts` で変更可能
- 仮想獲得メダルのみ。賭け、換金、決済なし
- PC、スマホ、タブレットの縦横レスポンシブ（スマホ縦画面はスクロールなしの1画面表示）
- 著作物の画像・音楽は使用せず、キャラクター画像は [設定ガイド](docs/characters/README.md) に基づくオリジナル素材
- 開発サーバー（`npm run dev`）では、PCの広い画面で左右にデバッグパネル（強制役・ストック・BARを狙え・バトル演出の指定、状態表示）が表示されます

## ファイル構成

機能ごとの入口・仕様書・テストの対応は [コードマップ](docs/code-map.md) を参照してください。

- `src/main.tsx` : React UI・ゲーム進行の状態管理・操作ハンドラ・筐体全体の描画
- `src/engine.ts` : 内部抽選と設定値、筐体ランプのモード判定（`src/engine.test.ts`）
- `src/battle/` : BATTLE MODE の G・フェーズ別の画像／SE・VOICE 決定表（`battle.test.ts`）
- `src/game/` : 押し順ナビ判定・BGM 選択・デバッグ指定変換（`game.test.ts`）
- `src/layout/` : 筐体のレスポンシブスケーリング計算（`cabinetLayout.test.ts`）
- `src/se.ts` / `src/bgm.ts` : 効果音・VOICE・BGM の再生制御
- `src/components/` : 液晶演出コンポーネント（BATTLE MODE、BONUS、雑魚戦ナビ、GAME OVER 等）
- `src/components/cabinet/` : 筐体パーツ・設定画面・デバッグパネル・小役オーバーレイ
- `src/style.css` : 筐体・レスポンシブレイアウト
- `public/` : ゲーム用画像・音声アセット（`public/audio/`）
- `docs/` : 演出・レイアウト・アセット等の仕様書、キャラクター設定ガイド

本作は既存作品のキャラクター、ロゴ、映像、楽曲を流用しない独立したオリジナルゲームです。

## License / Copyright

Copyright © 2026 tanzyyy-dev. All rights reserved.

本リポジトリは作品紹介・技術的な参考のために公開しています。ソースコードや素材の無断複製・改変・再配布・派生作品の公開・商用利用は許可していません（適用法令、GitHub利用規約、第三者のライセンス等で認められる場合を除く）。詳細は [COPYRIGHT.md](./COPYRIGHT.md) を参照してください。
