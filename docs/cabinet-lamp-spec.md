# 筐体ランプ（上下）色演出仕様

## 目的

筐体上部のトップランプ（`.top-crown`）、下パネル両サイドの縦型スリット LED バー（`.side-led-bar`）、およびスマホ縦画面時の左右拡張サイドフレーム LED（`.wing-led-strip`）の発光色を統一し、**通常時の状態色と小役獲得時の色が視覚的に混同されない**ようにするための仕様です。

## 対象コンポーネント

上下すべての筐体ランプは `resolveTopLampMode`（`src/engine.ts`）が返す単一の `topLampMode` に完全同期します。

- 上部トップランプ: `.top-crown.lamp-mode-<mode>`
- 下部サイド LED バー: `.side-led-bar.mode-<mode>`
- スマホ縦画面 拡張サイドフレーム LED: `.wing-led-strip.mode-<mode>`

## モード別カラー仕様（変更不可ルール）

### 1. 通常時（小役の色に対応しない非小役色を使用）

通常時の発光には、小役の色（黄・青・赤・緑）および虹色を**一切使用しません**。上下ランプともに紫系・白銀系で統一します。

| モード | 発生条件 | 発光色・演出 |
| --- | --- | --- |
| `ready` | 通常待機中（BET前・押し順ミス後など） | **アメジストパープル（紫）** ブレス呼吸発光 |
| `lever` | BET後・レバーON待機中 | **プラチナホワイト（白銀）** 脈動発光 |
| `spin` | リール回転中 | **バイオレット＆プラチナホワイト（紫白）** 高速走駆チェイス |

### 2. 小役獲得時（第3リール停止〜次BET／次レバーONまで）

| 役 | モード | 発光色・演出 |
| --- | --- | --- |
| ベル | `payout` | **黄色（イエロー / ゴールド）** フラッシュ |
| リプレイ | `payout-replay` | **青色（サファイア / コバルトブルー）** フラッシュ |
| チェリー | `payout-cherry` | **赤色（クリムゾンレッド）** フラッシュ |
| スイカ | `payout-melon` | **緑色（エメラルドグリーン）** フラッシュ |
| BAR揃い | `rainbow` | **虹色（レインボー）** ストロボ |

### 3. 特別演出時

| モード | 発生条件 | 発光色・演出 |
| --- | --- | --- |
| `battle` | BATTLE MODE 突入・バトル演出決着待ち | 真紅＆オレンジの炎ストロボ |
| `rainbow` | ボーナス確定（`bonusSpin`）・ボーナスGET（`bonusGet`）・WINランプ点灯・バトル継続勝利（`battleResult`） | **虹色（レインボー）** ストロボ |

## 優先順位

`resolveTopLampMode` の判定優先順位は以下の通りです。

1. `rainbow`（ボーナス確定・GET・BAR揃い・WIN・バトル勝利）
2. `battle`（`battleModeIntro` / `battle`）
3. `payout-cherry` / `payout-melon` / `payout`（`payout > 0` 時の成立役に応じた小役色）
4. `payout-replay`（`litRole === 'replay'` 時。リプレイ時は `payout === 0` かつ `scene === 'lever'` に遷移するため、`lever` より優先して青色を維持する）
5. `spin`（`scene === 'spinning'`）
6. `lever`（`scene === 'lever'`）
7. `ready`（上記以外の待機状態）

## 主な実装箇所

- モード判定ロジック: `src/engine.ts`（`TopLampMode`, `resolveTopLampMode`）
- 筐体への適用: `src/main.tsx`（`topLampMode`）
- 上下ランプのカラー定義: `src/style.css`（`.wing-led-strip.mode-*`, `.lamp-mode-*`, `.side-led-bar.mode-*`）
- 単体テスト: `src/engine.test.ts`（`resolveTopLampMode`）
