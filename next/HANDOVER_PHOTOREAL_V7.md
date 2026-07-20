# BONSAI Photoreal Craft v7 引き継ぎ表

この文書は、BONSAI専用リポジトリの次スペース・次担当へ、GitHub上の正本と残作業を引き継ぐためのものです。過去チャットの「完成」より、main、GitHub Actions、公開URL、Issue #1を優先してください。

| 項目 | 正本・状態 |
|---|---|
| リポジトリ | `shotakabahara-collab/bonsai-app` |
| 対象範囲 | BONSAIのみ。NOBUなど別リポジトリへ触れない |
| 統合PR | PR #11 `Photoreal Craft v7：写真状態針金・段階的な神舎利` |
| 本番統合SHA | `6b106f66e715eab4b4e685efd65e1453fa47fba3` |
| 公開リリース | `bonsai-photoreal-craft-v7` |
| 公開URL | `https://shotakabahara-collab.github.io/bonsai-app/?release=bonsai-photoreal-craft-v7` |
| 本番監査Issue | Issue #1 `AUTOMATED PASS / iPhone確認待ち` |
| セーブキー | `bonsai:v2` |
| 旧セーブキー | `bonsai_live_1` |

## 公開状態

- PR #11はsquash merge済み。
- GitHub Pagesへ`bonsai-photoreal-craft-v7`を公開済み。
- 公開URLのinstall、wait、smoke、seasonal、photoreal、files監査はすべてPASS。
- Issue #1はiPhone実画面確認まで開いたままにする。
- PR用の一時転送データ、適用・診断用Actions、旧v5 CIは削除済み。
- 恒久CIは`.github/workflows/photoreal-craft-v7-ci.yml`。

## ユーザー手動確認の結論

- 茶色いS字スタンプ型の旧針金は不合格として廃止した。
- 枝写真へ密着した透明WebP針金候補はユーザー合格済み。
- 写真状態の神・舎利はユーザー合格済み。
- 神・舎利は強度と経過期間に応じて段階・連続変化する仕様で合意済み。

## 実装済み

### 針金

- 頂部、第一枝、第二枝、第三枝、前枝、背枝の6部位。
- 軽針金・強針金の2種類、合計12枚の900×1500透明WebP。
- 枝の実写シルエットと葉の前後関係へ合わせ、白壁上のS字・浮遊線・丸印を廃止。
- 養成初期、中期、外し頃、食い込み注意で、光沢・接触感・食い込み感を変化。
- 早外し、中断、適期外し、遅延外し、定着率、傷、保存を維持。
- 針金装着中は品評会へ出展不可。

### 神・舎利

- 舎利は左右×強度1〜3の6枚。
- 神は6部位×強度1〜3の18枚。
- 合計24枚の900×1500透明WebP。
- 強度上昇は不可逆。追加加工により1→2→3へ進む。
- 樹皮剥離直後、乾燥中、繊維整形、保護処理、風化中、風化完成を維持。
- 各工程内も0〜100%の進行率を持ち、湿潤、彩度、明度、木目、亀裂を連続補間。
- 中断中は進行を止め、再開時は残り時間から継続。
- 未完成中は品評会へ出展不可。

### 既存仕様の維持

- 剪定は不可逆。
- 季節外・樹勢不足でも師匠の警告後に実行可能。
- 危険作業は病気、害虫、枯れ込み、生育抑制、枯死へ決定論的につながる。
- 再読み込みで作業結果を引き直せない。
- 施肥・堆肥はUI、保存、計算に存在しない。
- `bonsai:v2`と`bonsai_live_1`の移行を維持。
- 同一個体、幹、根張り、主要枝、カメラ位置を維持。

## 主要変更ファイル

```text
.github/workflows/deploy-react-v1.yml
.github/workflows/photoreal-craft-v7-ci.yml
next/public/sw.js
next/scripts/generate-wire-photo-v7.py
next/scripts/generate-deadwood-photo-v6.py
next/scripts/visual-audit-v6.py
next/src/BonsaiStage.tsx
next/src/CraftPanels.tsx
next/src/craft-v3.ts
next/src/craft-v3.css
next/src/main.tsx
next/src/photoreal-v6.css
next/tests/authentic-v5-unit.mjs
next/tests/authentic-v5.mjs
next/tests/smoke.mjs
```

画像資産：

```text
next/public/assets/kuromatsu/wire-photo-v7/*.webp       12枚
next/public/assets/kuromatsu/deadwood-photo-v6/*.webp   24枚
```

## 合格済みゲート

- TypeScript型検査
- Photoreal v7決定論的単体試験
- Vite本番ビルド
- 針金・神・舎利画像の決定論的再生成
- 390×844 / DPR 3 WebKit
- 旧セーブ移行・既存smoke・季節応答
- 危険剪定と時間経過結果
- 針金中断
- 神・舎利の強度、工程内進行、中断・再開
- previewサーバー停止後の完全オフライン再起動
- S字、背景漏れ銅線、発光帯、白帯、円形マーカーの画素拒否
- GitHub Pages公開URLで同一監査

## 次スペースで最初に読むもの

1. 現在のmain
2. PR #11
3. Issue #1
4. GitHub Actionsの直近実行
5. 本ファイル

## 残作業

1. 公開URLをユーザーのiPhoneで開く。
2. 針金、神・舎利強度、工程途中、中断、再読み込み、機内モードを確認する。
3. 実機合格後にだけIssue #1を閉じ、完成判断する。

## 本番へ戻してはいけない表現

- 茶色いS字、短冊、スタンプ状の針金
- 枝のない白壁上へ浮く銅線
- 白い帯、暗い楕円、写真を横断する線
- 均一幅で発光する神・舎利
- 円形アンカーや編集マーカー
