# アセット可逆圧縮・最適化仕様

`public/` 配下に配置する画像・音声アセットについて、**画質・音質の劣化を一切伴わない可逆圧縮（ロスレス最適化）** の方式と再現手順を定めます。

## 基本方針

- **品質劣化ゼロ**: 解像度変更、非可逆再エンコード（JPEG品質引き下げ、MP3再エンコード、不可逆WebP変換等）は行いません。
- **サイズ縮小時のみ置換**: 最適化後のファイルサイズが元ファイルより小さくなった場合のみ置き換えます。
- **フォーマット変換時のルール**: 透過PNGを可逆WebP（`cwebp -lossless -z 9`）へ変換した場合は、参照元コードを更新し旧PNGファイルを削除します（[`AGENTS.md`](../AGENTS.md)「画像素材の差し替え」準拠）。ただし、`apple-touch-icon.png` のようにブラウザ／OS仕様上PNGが必須のファイルはPNG形式のまま最適化します。

---

## 形式別の圧縮方式と再現コマンド

### 1. JPEG (`public/*.jpg`)

- **方式**: ハフマンテーブルの可逆最適化 ＋ プログレッシブJPEG化 ＋ 不要メタデータ（EXIF等）除去
- **ツール**: `jpegtran` (`libjpeg-turbo`)
- **コマンド**:
  ```bash
  jpegtran -copy none -optimize -progressive -outfile <output.jpg> <input.jpg>
  ```

### 2. ゲーム用PNG (`public/*.png`, アイコン除く)

- **方式**: 可逆WebP変換（圧縮レベル最大 `-z 9`）
- **ツール**: `cwebp` (`libwebp`)
- **コマンド**:
  ```bash
  cwebp -quiet -lossless -z 9 <input.png> -o <output.webp>
  ```
- **補足**: 変換後、コード内のパスを `.webp` に更新し、元の `.png` を削除します。

### 3. PNG必須アセット (`public/apple-touch-icon.png` 等)

- **方式**: PNG形式を維持したままの可逆再圧縮
- **ツール**: Python `Pillow` (`optimize=True`)
- **コマンド**:
  ```bash
  python3 -c 'from PIL import Image; Image.open("public/apple-touch-icon.png").save("public/apple-touch-icon.png", "PNG", optimize=True)'
  ```

### 4. 既存WebP (`public/*.webp`)

- **方式**: 原則そのまま維持（既存の不可逆WebPを可逆WebPで再エンコードするとファイルサイズが増加し、不可逆再エンコードは品質劣化を招くため）
- **チェックコマンド**（メタデータ混入確認）:
  ```bash
  webpmux -info <file.webp>
  ```
  `EXIF` / `XMP` / `ICCP` が含まれる場合のみ `webpmux -strip` 等でメタデータ除去を検討します。

### 5. MP3 (`public/audio/*.mp3`)

- **方式**: 音声ストリームの無劣化コピー（`-c:a copy`）＋ ID3等のメタデータ除去（`-map_metadata -1`）
- **ツール**: `ffmpeg`
- **コマンド**:
  ```bash
  ffmpeg -y -loglevel error -i <input.mp3> -c:a copy -map_metadata -1 <output.mp3>
  ```

### 6. WAV (`public/audio/*.wav`)

- **方式**: 非圧縮PCMを維持（Web Audio `decodeAudioData` の互換性および無劣化維持のため再エンコードしない）

---

## 初回実施時の実測結果（2026-11-15）

圧縮対象となった12ファイルの合計サイズは **21,028,440 B → 19,355,333 B（-7.96%、1,673,107 B 削減）** となりました。

| ファイル | 方式 | 圧縮前 (B) | 圧縮後 (B) | 縮小率 |
| --- | --- | ---: | ---: | ---: |
| `public/battle_girl_revive.jpg` | `jpegtran` 可逆最適化 | 954,165 | 867,779 | -9.05% |
| `public/battle_intro_arena.jpg` | `jpegtran` 可逆最適化 | 626,223 | 576,038 | -8.01% |
| `public/battle_mode_lit.jpg` | `jpegtran` 可逆最適化 | 801,147 | 696,092 | -13.11% |
| `public/battle_mode_off.jpg` | `jpegtran` 可逆最適化 | 661,987 | 595,786 | -10.00% |
| `public/belly_glass_protagonist.jpg` | `jpegtran` 可逆最適化 | 959,325 | 856,219 | -10.75% |
| `public/reel_side_bg.jpg` | `jpegtran` 可逆最適化 | 697,155 | 637,373 | -8.58% |
| `public/mass_production_soldier.png` → `.webp` | `cwebp -lossless -z 9` | 1,865,683 | 693,776 | -62.81% |
| `public/apple-touch-icon.png` | Pillow PNG `optimize=True` | 29,506 | 27,557 | -6.61% |
| `public/audio/bgm_battle.mp3` | `ffmpeg` メタデータ除去 | 4,289,082 | 4,282,034 | -0.16% |
| `public/audio/bgm_gameover.mp3` | `ffmpeg` メタデータ除去 | 4,335,819 | 4,328,427 | -0.17% |
| `public/audio/bgm_opening.mp3` | `ffmpeg` メタデータ除去 | 1,513,624 | 1,506,576 | -0.47% |
| `public/audio/bgm_pre_battle.mp3` | `ffmpeg` メタデータ除去 | 4,294,724 | 4,287,676 | -0.16% |
| **合計（上記12ファイル）** | — | **21,028,440** | **19,355,333** | **-7.96%** |

※ `public/battle_*.webp`（18ファイル）はメタデータ無し・最適化済みのため変更なし。`public/audio/*.wav`（23ファイル）は不要メタデータ無しのため変更なし。

---

## アセット追加・差し替え時のチェックリスト

1. 新規追加・差し替えしたアセットに対し、上記の形式別可逆圧縮コマンドを実行する。
2. 圧縮後のサイズが元より小さい場合のみ採用する。
3. PNG を可逆WebP へ変換した場合は、`src/`・`index.html` の参照パスを更新し、旧 `.png` を削除する。
4. `npm run typecheck && npm test && npm run build` でビルドとテストが通ることを確認する。
