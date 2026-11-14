# キャラクター設定資料

このディレクトリには、制作時に外見を合わせるための設定ガイドを保管します。これらは参照資料であり、`public/` に置かれたゲーム用画像とは用途を分けています。設定ガイドをゲーム画面へ直接表示する素材として扱わないでください。

キャラクターのイラストや演出を制作・変更する際は、該当するガイドを確認し、基本デザインを一貫させてください。運用ルールはリポジトリルートの [`AGENTS.md`](../../AGENTS.md) に記載しています。

## 設定ガイド一覧

| キャラクター | 役割 | 外見上の特徴 | 設定ガイド |
| --- | --- | --- | --- |
| 主人公 | 主人公 | 黒髪の逆立った髪、黒いジャケットと金の縁取り、ボルドーのスカーフ。背面に稲妻状の金色のマーク。 | [`protagonist.png`](design-guides/protagonist.png) |
| ヴォルグ | ボスキャラクター | 巨体、紫のマント、金属製の仮面、紫に発光する目、金色の紋章。 | [`volg.png`](design-guides/volg.png) |
| 量産型兵士 | ヴォルグ軍団の一般戦闘員 | 黒いマスクと戦闘服、黄色く発光する目、胸の共通紋章。個体差を抑えた統一デザイン。 | [`mass-production-soldier.png`](design-guides/mass-production-soldier.png) |
| セリーヌ | 主人公の復活を導く女性 | 金髪、青い瞳、黒を基調に金の装飾と赤い差し色を配した衣装。金色の十字形シンボル。 | [`celine.png`](design-guides/celine.png) |
| カイ | 主人公を支える仲間 | 銀髪、灰青色の瞳、深緑のロングコート、金の装飾、灰色のスカーフ。背面に金色の紋様。 | [`kai.png`](design-guides/kai.png) |

## ファイル構成

```text
docs/characters/
├── README.md
└── design-guides/
    ├── protagonist.png
    ├── volg.png
    ├── mass-production-soldier.png
    ├── celine.png
    └── kai.png
```

キャラクターが増えたら `design-guides/` に識別しやすい名前のガイド画像を追加し、この索引と `AGENTS.md` の一覧を更新してください。
