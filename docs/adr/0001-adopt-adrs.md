# ADR-0001: Adopt ADRs for architectural decisions

## Context

`dax6` リポジトリは個人管理の ZMK ファームウェア設定で、意思決定は次の場所に分散していた:

- `git commit` メッセージ（driver 移行、workaround の実装理由、電源チューニングの数値根拠）
- GitHub PR 本文（テスト計画、代替案の言及）
- ローカルエージェント履歴（`ctx` に残るセッション。設計相談・失敗した仮説・撤回された案）
- `CLAUDE.md`（最新の確定仕様と一部トラブルシューティング）
- `docs/encoder-tuning-learnings.md`（エンコーダに閉じた試行錯誤の学び）

判断根拠が「そこにあるはず」の状態で、駆逐された案・upstream バグへの workaround 選択理由・SHA pinning の背景などが `git log` を丁寧に辿らないと復元できない。将来の改修や再燃時に同じ調査を繰り返す非効率が発生している。

## Decision

軽量ADR（Architecture Decision Records）を `docs/adr/` に集約する。

- フォーマット: 5 節（`Context` / `Decision` / `Consequences` / `Status` / `Superseded-by`）+ 任意の `Follow-ups` + 末尾 `Related learnings:` 行
- 番号採番: 4 桁連番（`NNNN-<slug>.md`）、テンプレートは `_template.md`（`_` prefix で連番から分離）
- インデックス: `docs/adr/README.md` を手動メンテ（自動生成しない）
- 起票判断・更新運用ルール: `CLAUDE.md` の「ADR運用ルール」節に集約し、日常作業中に自発的に「これはADR案件」と提示できる状態にする
- 言語: 日本語（本文）+ 英語コード識別子（`CLAUDE.md` と同じポリシー）
- 役割分担:
  - **ADR**: なぜその決定に至ったか（判断根拠・代替案・トレードオフ）
  - **`CLAUDE.md`**: 現在の確定仕様・挙動・手順
  - **learnings doc**: 試行錯誤の過程

MADR / adr-tools のようなフォーマル規約や slash command / skill による自動化は採用しない（個人リポで意思決定頻度が低いため、フォーマット重量化のコストが利益を上回る）。将来必要になったら軽量ADRからマイグレーションできる。

## Consequences

- 新規意思決定時のオーバーヘッドが1件あたり100行程度のADR起票分だけ増える
- 過去の判断根拠を「なぜ」の観点で検索・参照できるようになる
- `CLAUDE.md` は「確定仕様」に専念でき、経緯・背景を切り離せる
- Superseded 運用により「撤回した案」の記録も追跡可能
- 初期投入として8本（0001〜0008）のADRを起こす。以降は必要になった時点で追加する

## Status

`Draft`（2026-07-11）

## Superseded-by

-

---

Related learnings: -
