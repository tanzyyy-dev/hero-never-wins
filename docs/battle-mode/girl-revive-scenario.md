# BATTLE MODE 追加演出仕様：girl_revive（セリーヌ復活）

> **ステータス：オーナー指示により現行実装を正として作成（2026-11-15）**
>
> 本書は `girl_revive` 専用の場面進行・画像・SE・VOICE を定める正本。
> [BATTLE MODE 基本演出仕様](battle-mode-basic-structure.md) の**基本14枚に、既存の復活カットイン画像1枚を加えて**構成する。
> 基本14枚の枚数・他の演出シナリオは変更しない。

## 1. シナリオの核心

敵ヴォルグが先制して必殺技を命中させ、主人公は7〜8Gを耐えるが、**8G終了後に一度倒れて敗北したように見せる**。
「CHANCEボタンを押せ!!」の入力を受けて**セリーヌの復活カットイン**が入り、主人公が立ち上がって次ROUNDへ継続する。

- 1〜8G は基本仕様の**敵先制ルート**をそのまま使用する。セリーヌは8G終了後の復活カットインにのみ登場する。
- **セリーヌは敵を倒さない。主人公もこのシナリオ内で反撃しない。** 復活の結果は「主人公が立ち上がる」まで。
- カイ援軍とは別シナリオ。セリーヌ復活ルートにカイを登場させない。
- 8G終了後の「倒れる」画面は `defeat`（本当の敗北）と共通にし、CHANCE入力までは復活か敗北かを判別させない。
- キャラクターの外見は [正式ガイド](../characters/README.md) に従う。セリーヌは [celine.png](../characters/design-guides/celine.png)、主人公は [protagonist.png](../characters/design-guides/protagonist.png)、ヴォルグは [volg.png](../characters/design-guides/volg.png) を確認する。

## 2. 8Gと結果告知の構成

| タイミング | フェーズ（`BattlePhase`） | 内容 | 使用画像 |
| --- | --- | --- | --- |
| 1G | `fighting` | 対峙 | 基本 `battle_base_g01_standoff.webp` |
| 2G | `fighting` | 緊張・対峙継続 | 基本 `battle_base_g02_tension.webp` |
| 3G | `fighting` | ヴォルグ先制 | 基本 `battle_base_g03_enemy_first.webp` |
| 4〜5G | `fighting` | ヴォルグ必殺技 | 基本 `battle_base_g04_05_enemy_special.webp` |
| 6G | `fighting` | 必殺技が主人公に命中 | 基本 `battle_base_g06_enemy_hits.webp` |
| 7〜8G | `fighting` | 主人公が耐える | 基本 `battle_base_g07_08_hero_endures.webp` |
| **8G終了後** | `false_defeat` | **主人公が倒れる（敗北に見せかけた静止）＋「CHANCEボタンを押せ!!」** | 基本 `battle_base_result_hero_falls.webp` |
| **CHANCE入力後** | `revive_cutin` | **セリーヌ復活カットイン** | 既存 `battle_girl_revive.jpg` |
| 続けて | `victory_reveal` | **主人公が立ち上がる → REVIVAL / CONTINUE** | 基本 `battle_base_result_hero_rises.webp` |

## 3. CHANCE入力と表示タイミング

- `false_defeat` 中は「CHANCEボタンを押せ!!」を表示し、CHANCEボタン・画面タップ・Space／Enter キーのいずれかの入力を待つ。
- AUTO PLAY 中は一定時間後（通常 1.2 秒、倍速 0.85 秒）に自動で押下し、プロンプトとホワイトアウト演出を省略しない。
- 入力後の進行（`src/main.tsx` の `resolveFalseDefeatChance`）：

| 経過時間（入力時点を0） | 内容 |
| --- | --- |
| 0 秒 | CHANCE押下SE（`chance_press`）、ホワイトアウト開始 |
| 0.32 秒 | 復活カットイン（`revive_cutin`）表示、`revive_fanfare` SE、セリーヌ VOICE、金色フラッシュ＋画面揺れ |
| 0.92 秒 | ホワイトアウト終了 |
| 1.72 秒 | 結果告知（`victory_reveal`）：主人公が立ち上がる画像に REVIVAL / CONTINUE エンブレム、`emblem_slam` SE |
| 3.12 秒 | 次ROUNDへ遷移 |

`defeat` の場合は同じ入力後、0.32 秒で敗北確定（`defeat_reveal`、BATTLE END）、2.42 秒で GAME OVER へ進む。

## 4. エフェクト・SE・VOICE

| 場面 | エフェクト・SE | VOICE |
| --- | --- | --- |
| 1〜8G | 基本の敵先制ルートと同じ | 基本の敵先制ルートと同じ（3G `voice_boss_provocation`、4G `voice_boss_spacial_attack`、6G `voice_hero_damage`） |
| 8G終了後 | 暗転フェード、`false_defeat` SE | なし |
| 復活カットイン | 金色の光芒（`revive-divine-rays`）、金色ダブルストロボ、`revive_fanfare` SE | **セリーヌ `voice_support`**（1回のみ） |
| 結果告知 | REVIVAL / CONTINUE エンブレム、`emblem_slam` SE | なし |

- VOICE 音源は人間が制作する。エージェントは新規 VOICE の生成・TTS・仮音声での代用を行わない。
- 音源が無い・読み込めない場合も再生を安全にスキップし、進行を止めない。

## 5. 抽選・ストックとの関係

- `girl_revive` は継続時の演出パターンとして抽選される（`src/engine.ts` の `drawWinPattern`：主人公先制 10%／カイ援軍 45%／セリーヌ復活 45%）。
- BATTLE MODE 開始時に敗北当選でもストックがあれば、1個消費して継続パターン（上記抽選）に救済される。
- BATTLE MODE 中（1〜8G）にチェリー等でストックを獲得し、パターンが `defeat` のまま8Gを終えた場合は、8G終了時にストックを1個消費して `girl_revive` に切り替える（デバッグで敗北を強制指定した場合を除く）。
- 本演出のために抽選確率、継続率、ストック獲得・消費、小役払出し、押し順ナビ、ROUND進行を変更しない。

## 6. 実装の境界・技術上の注意

- 画像割当は `src/components/BattleSceneDisplay.tsx` の `resolveBattleArtwork`、進行は `src/main.tsx` で行う。
- 復活カットインは既存の `battle_girl_revive.jpg` を流用する。差し替える場合はセリーヌの設定ガイドを外見の基準とし、画像内に台詞の文字を描き込まない。
- 静止画自体で出来事が判別できること。CSS transform で人物の演技を捏造しない。
- 他シナリオ（`hero_attack`、`ally_save`、`defeat`）にセリーヌの絵を表示しない。

## 7. 変更管理

- 8G終了後の「倒れる → CHANCE入力 → 復活カットイン → 立ち上がる」の構成を勝手に改変しない。
- セリーヌやカイによる敵撃破、主人公による追撃、余計な攻撃の追加は認めない。
- 本書の変更は、事前にオーナーの明示的な合意を得てから行う。
