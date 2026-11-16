# Changelog

## Ver.0.1.1 — iOS Stability & Performance Update

- iOS環境におけるBGM再生安定性の改善（単一 `HTMLAudioElement` 再利用、ユーザー操作アンロック強化、音量変更とトラック切り替えの分離、非同期 `play()` 競合ガードおよび失敗時復旧）
- 初回ロード・ゲーム開始処理の最適化（全画像・全SEの進捗付きロード/デコード、ロード完了まで操作無効化する `NOW LOADING...` 表示）
- リール図柄の色彩・描画不具合の修正（全図柄のSVG `<defs>` ID一意化、二重フィルター解消、`symbol-backlight` とのレイヤー分離および停止時 `filter` リセット明示）
