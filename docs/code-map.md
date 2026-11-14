# コードマップ（機能別の入口・テスト単位）

調査・改修・機能追加のときに「どこから読み始め、どのテストを回すか」を引くための索引です。
全仕様の説明ではありません。詳細な演出・レイアウト仕様は各仕様書を参照してください。
行番号は書かず、**検索できる関数名・定数名・CSS 見出し**で示します。

## 1. 置き場所のルール

| 置き場所 | 置くもの | テスト |
| --- | --- | --- |
| `src/engine.ts` | 抽選・確率・払出し・ストック・ランプモードなど**ゲーム性の中核**（React 非依存） | `npm run test:engine` |
| `src/battle/` | BATTLE MODE の G・フェーズ別の**画像／SE・VOICE 決定表**（純粋関数） | `npm run test:battle` |
| `src/game/` | 押し順ナビ判定・BGM 選択・デバッグ指定変換など**進行／操作の判定**（純粋関数） | `npm run test:game` |
| `src/layout/` | 筐体のレスポンシブスケーリング計算（純粋関数） | `npm run test:layout` |
| `src/main.tsx` | `App`: 状態（useState + 同期用 useRef）、操作ハンドラ、タイマー、全体描画 | なし（手動確認） |
| `src/components/` | 液晶演出コンポーネント（各 `.css` を同居） | なし |
| `src/components/cabinet/` | 筐体パーツ・設定画面・デバッグパネル・小役オーバーレイ（CSS は `src/style.css`） | なし |
| `src/se.ts` / `src/bgm.ts` | 効果音・VOICE・BGM の再生（Web Audio / HTMLAudio） | なし |

新しい判定ロジックは、まず `main.tsx` から切り離せる純粋関数として上記モジュールに置き、テストを添えてください。
`main.tsx` には「状態の読み書き・SE/演出の発火・タイマー」だけを残すのが目安です。

## 2. 機能別の入口

| 機能 | まず読む場所 | 仕様書 | テスト |
| --- | --- | --- | --- |
| 設定1〜6・小役確率・配当 | `engine.ts` `SETTINGS` / `drawSpin` / `SPIN_ROLES` / `CHERRY_CONFIGS` | README「現在の仕様」 | engine |
| メダル払出し（CREDIT上限・下皿） | `engine.ts` `calculateMedalPayout`、`main.tsx` `applyMedalPayout` | README | engine |
| BET・レバー・リール停止 | `main.tsx` `onBet` / `onLever` / `onStop` | README | — |
| 押し順ナビ・取りこぼし | `game/navi.ts` `isNaviMissOnStop` / `resolveNaviReelDisplay`、出目は `engine.ts` `getMissReels` | README | game |
| 自動停止（オート・どこでもタップ・Space） | `game/navi.ts` `pickNaviStopReel`、`main.tsx` `stopNextReel` / `performPrimaryAction` / `AUTO PLAY Timer Logic` | README「遊び方」 | game |
| ボーナス揃え（777）・BONUS GET | `main.tsx` `onStop` の `bonusSpin` 分岐 / `onStartBonus`、`components/BonusKakuteiDisplay.tsx` / `BonusGetDisplay.tsx` | — | — |
| 雑魚戦（ベル8回でBATTLE MODE） | `main.tsx` `onStop` のベル分岐（`BELLS_TO_BATTLE`）、`components/ZakoNaviDisplay.tsx` | — | — |
| バトル継続抽選・ストック消費 | `engine.ts` `resolveBattleWithStock` / `drawWinPattern`、`main.tsx` `onStartBattleAction` / `resolveNextBattle`、8G終了時のストック救済は `onStop`（`curG >= 8`） | [基本演出仕様](battle-mode/battle-mode-basic-structure.md) | engine |
| BATTLE MODE の画像（8G・14枚） | `battle/battleArtwork.ts` `resolveBattleArtwork` / `BATTLE_BASE_IMAGES`、表示は `components/BattleSceneDisplay.tsx` | [基本演出仕様](battle-mode/battle-mode-basic-structure.md) | battle |
| BATTLE MODE 各GのSE・VOICE | `battle/battleCues.ts` `resolveBattleLeverCue`（呼び出しは `main.tsx` `onLever`）、音色は `se.ts` `playBattleSe` | 同上 | battle |
| レバーON時の液晶エフェクト（揺れ・フラッシュ） | `battle/battleArtwork.ts` `resolveLeverFx`、`BattleSceneDisplay.tsx` の useEffect 群 | 同上 | battle |
| 8G終了後（CONTINUE・肩叩き・敗北・特別終了） | `main.tsx` `onStop` の `curG >= 8` 分岐、`resolveFalseDefeatChance`、`finishToNextRound` / `finishToGameOver` | 各シナリオ仕様 | battle（画像のみ） |
| カイ援軍 `ally_save` | 上記に加え `ALLY_SAVE_IMAGES`、`ally_shoulder_tap` フェーズ | [ally-save](battle-mode/ally-save-scenario.md) | battle |
| セリーヌ復活 `girl_revive` | 上記に加え `false_defeat` → `revive_cutin` フェーズ、`REVIVE_CUTIN_IMAGE` | [girl-revive](battle-mode/girl-revive-scenario.md) | battle |
| 小役演出（チェリー・スイカ・BARを狙え） | `components/cabinet/SmallRoleOverlays.tsx`、発火は `main.tsx` `onLever` / `trigger*`、発生率は `engine.ts` `BAR_AIM_RATES` | — | engine |
| プレミアムBAR演出 | `components/PremiumBarDisplay.tsx`（PixiJS + GSAP）、`main.tsx` `triggerPremiumBarEffect` | — | — |
| 筐体ランプ色（上下・サイドフレーム） | `engine.ts` `resolveTopLampMode`、`components/cabinet/CabinetFrame.tsx`、CSS「トップランプ演出モード別」 | [ランプ仕様](cabinet-lamp-spec.md) | engine |
| レスポンシブ・スマホ縦1画面 | `layout/cabinetLayout.ts` `computeCabinetLayout`、CSS「MOBILE PORTRAIT」「RESPONSIVE DESIGN」 | [レイアウト仕様](cabinet-responsive-layout.md) | layout |
| BGM | `game/sceneBgm.ts` `resolveSceneBgmTrack`、ファイルは `bgm.ts` `BGM_PATHS` | `public/audio/README.md` | game |
| SE・VOICE ファイル | `se.ts` `SeKey` / `SE_FILES`（未配置でもエラーにしない） | `public/audio/README.md` | — |
| 設定画面（SOUND / AUTO / 倍速） | `components/cabinet/LcdSettingsView.tsx`、開閉は `main.tsx` `menuOpen` | — | — |
| GAME OVER 結果画面 | `components/GameOverResultDisplay.tsx` | — | — |
| セッション切れ・入力抑止 | `main.tsx` `resetForNewSession` / `SESSION_TIMEOUT_MS`、右クリック等の抑止 useEffect | — | — |
| デバッグパネル（DEV のみ） | `game/debugOptions.ts`、`components/cabinet/DebugPanels.tsx`、`engine.ts` `DEBUG_BATTLE_SCENARIOS` | README | game / engine |
| 画像・音声アセット | `public/` | [アセット圧縮仕様](assets-compression-spec.md)、[キャラ設定](characters/README.md) | battle（バトル画像の存在確認） |

### 開発用コンソールフック（`npm run dev` のみ）

`main.tsx` の DEV 用 useEffect で `window` に登録されます。ブラウザ確認の近道として使えます。

- `__setBattleTest(pattern, g = 1, phase = 'fighting', specialEnemyDefeat = false)` — 任意のバトル場面へジャンプ
- `__setBattleIntroTest()` — BATTLE MODE 突入演出へ
- `__playVoiceTest(key)` — VOICE 単体再生
- `__setMedalsTest(n)` — TOTAL 獲得枚数を設定

## 3. テストの実行単位

| コマンド | 対象 | 回すタイミング |
| --- | --- | --- |
| `npm test` | `src/**/*.test.ts` 全部（数百ms） | 変更後の最終確認 |
| `npm run test:engine` | 抽選・確率・払出し・ストック・ランプ | `engine.ts` を触ったとき |
| `npm run test:battle` | バトル画像14枚・シナリオ別の画像／SE・VOICE の仕様不変条件、画像ファイルの存在 | `src/battle/`・`BattleSceneDisplay`・バトル画像を触ったとき |
| `npm run test:game` | 押し順ナビ・自動停止・BGM 選択・デバッグ指定 | `src/game/`・`main.tsx` の操作系を触ったとき |
| `npm run test:layout` | 代表端末サイズでの1画面収まり・bottom-compact・横画面 | `src/layout/` を触ったとき |
| `npm run check` | 型チェック + 全テスト | コミット前 |

- テストは Node 標準の `node --test` で TypeScript を直接実行します（型ストリップのため **Node.js 22.18+ / 23.6+** が必要）。
- テストから読み込むモジュールは、相対 import に **`.ts` 拡張子を付け**、型だけの import は **`import type`** にしてください（Node の型ストリップは型 import を自動判別しません）。React・DOM に依存するモジュールはテストから読み込めません。
- テストファイルは `tsconfig.app.json` で型チェック対象外です（`@types/node` 未導入のため）。
- `battle.test.ts` は仕様書の不変条件（14枚・4G/5G と 7G/8G の共用・`girl_revive` が CHANCE 前に `defeat` と区別できないこと等）を固定しています。**このテストを仕様変更なしに書き換えて通さないでください。** 変更が必要なら AGENTS.md の合意ルールに従います。

## 4. よくある変更の手順

- **小役を追加・確率を変える**: `engine.ts` の `SETTINGS`（合計 1.0）→ `SPIN_ROLES` に役定義 → `drawSpin` の分岐 → 払出し処理は `main.tsx` `onStop` の役別分岐 → ランプ色は `resolveTopLampMode` と [ランプ仕様](cabinet-lamp-spec.md)。デバッグ選択肢は `SPIN_ROLES` から自動生成（スイカのように分割する場合は `game/debugOptions.ts`）。
- **バトルのあるGのSE・VOICEを変える**: `battle/battleCues.ts` を編集し `npm run test:battle`。音色そのものは `se.ts` `playBattleSe` の該当 `case`。
- **バトル画像を差し替える**: `public/` のファイルを置き換え（[アセット圧縮仕様](assets-compression-spec.md)）、パスが変わる場合は `battle/battleArtwork.ts` のみ更新。旧ファイルの参照残りを `grep` で確認。
- **筐体の見た目を調整する**: JSX は `components/cabinet/CabinetFrame.tsx` または `main.tsx` の描画部（リール・操作卓）、CSS は `src/style.css` の該当見出し（下表）。

## 5. `src/style.css` の見出し索引

`/* ====` で始まるブロックコメントの見出しで検索できます（上から順）。

| 見出し（検索語） | 内容 |
| --- | --- |
| `MOBILE PORTRAIT EXPANDED SIDE WINGS` | スマホ縦の左右拡張サイドフレーム |
| `AUTHENTIC PACHISLOT CABINET` | 筐体外枠・`bottom-compact` |
| `1. TOP ILLUMINATION CROWN` | トップランプ形状 |
| `トップランプ演出モード別` | ランプ色モード（`lamp-mode-*` / `mode-*`） |
| `2. UPPER LCD SCREEN` | 液晶枠・下部ナビストリップ |
| `LCD SETTINGS VIEW` | 設定画面 |
| `3. REEL SECTION` | リール・ペイライン・MAX BET・ミニLED |
| `Right: BATTLE MODE Lamp` | BATTLE MODE ランプ・押し順ナビランプ |
| `4. MID CONTROL DECK` / `円形物理CHANCEボタン` / `下段: レバー` / `STOPボタンの品質向上` | 操作卓 |
| `5. BELLY GLASS PANEL` | 腹パネル・サイドLEDバー |
| `6. BOTTOM CABINET DECK` | スピーカー・下皿・最下部リム |
| `RESPONSIVE DESIGN` | PC・タブレット・スマホ横画面 |
| `Cherry Role Visual Effect` / `Single Cherry Whole-Cabinet Flash` | チェリー演出 |
| `Session Expired Notice Overlay` | セッション切れ通知 |
| `DEV DEBUG PANELS` | デバッグパネル |
| `「BARを狙え！」カットイン演出` / `スイカ成立時エフェクト` | 小役演出 |

液晶演出コンポーネント（`src/components/*.tsx`）の CSS は同名の `.css` に分かれています。

## 6. 既知の注意点

- `main.tsx` の状態は **useState と同名の useRef（`xxxRef`）を二重に持つ**ものが多くあります。タイマー・イベントハンドラ内では ref を読み、更新時は両方を書き換える既存の流儀に合わせてください。
- `Scene` の `'battle'` / `'battleResult'` と `onBattle` / `onNext` は旧バトル方式の名残で、現在この scene に遷移する経路はありません（BATTLE MODE は `isBattleMode` + `battleGame` + `battlePhase` で表現）。削除する場合は `resolveTopLampMode` のテストも含めて影響を確認してください。
- 8G終了後の分岐タイミング（`setTimeout` の ms）は演出・VOICE 尺と同期しています。値を変える場合は該当シナリオ仕様を確認してください。
