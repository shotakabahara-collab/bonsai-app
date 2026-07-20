# BONSAI Photoreal Craft v7 引き継ぎ表

この文書は、BONSAI専用リポジトリの次スペース・次担当へ、GitHub上の正本と残作業を引き継ぐためのものです。

| 項目 | 正本・状態 |
|---|---|
| リポジトリ | `shotakabahara-collab/bonsai-app` |
| 対象範囲 | BONSAIのみ。NOBUなど別リポジトリへ触れない |
| 作業PR | PR #11 `agent/photoreal-craft-v6-final` → `main` |
| PR基点 | main `b7fd1307b063b11c827e7718b02546b256f0bec6` |
| 監査済み実装コミット | `8e3653dcad376be092f389d34f396fb4e689d265` |
| 目標リリース | `bonsai-photoreal-craft-v7` |
| 現在公開中 | `bonsai-authentic-consequences-v5`。PR統合前は変更しない |
| 現行公開URL | `https://shotakabahara-collab.github.io/bonsai-app/?release=bonsai-authentic-consequences-v5` |
| v7公開候補URL | `https://shotakabahara-collab.github.io/bonsai-app/?release=bonsai-photoreal-craft-v7` |
| 本番監査Issue | Issue #1。公開後のiPhone確認まで閉じない |
| セーブキー | `bonsai:v2` |
| 旧セーブキー | `bonsai_live_1` |

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
- 養成初期、中期、外し頃、食い込み注意で、光沢・接触感・食い込み感を連続変化。
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
.github/workflows/photoreal-craft-v6-ci.yml
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

## 合格済み最終ゲート

`Materialize and audit approved photographed wire v7` run #5で次を合格済み。

- 実装パッチSHA-256照合
- 針金・神・舎利画像の二重生成一致
- TypeScript型検査
- Photoreal v7決定論的単体試験
- Vite本番ビルド
- 390×844 / DPR 3 WebKit
- 旧セーブ移行・既存smoke・季節応答
- 危険剪定と時間経過結果
- 針金中断
- 神・舎利の強度、工程内進行、中断・再開
- previewサーバー停止後の完全オフライン再起動
- S字、背景漏れ銅線、発光帯、白帯、円形マーカーの画素拒否

## 次スペースで最初に読むもの

1. 現在のmain
2. PR #11の最新headと全チェック
3. Issue #1
4. GitHub Actionsの直近実行
5. 本ファイル

過去チャットの「完成」より、GitHubのコード、Actions、公開URL、Issue #1を正本とする。

## 残作業

1. PR #11の最新headで恒久CI 2本がPASSしていることを確認。
2. PR本文を最新SHA・v7仕様・監査値へ更新し、Ready化。
3. PR #11をmainへ統合。
4. `Deploy BONSAI React production`のローカル監査、Pages配信、公開URL監査を全て確認。
5. Issue #1にmain統合SHA、公開監査SHA、リリースID、公開URLを記録。
6. iPhone実機で、針金、神・舎利強度、工程途中、中断、再読み込み、機内モードを確認。
7. 実機合格後にだけIssue #1を閉じ、完成判断する。

## 本番へ戻してはいけない表現

- 茶色いS字、短冊、スタンプ状の針金
- 枝のない白壁上へ浮く銅線
- 白い帯、暗い楕円、写真を横断する線
- 均一幅で発光する神・舎利
- 円形アンカーや編集マーカー

