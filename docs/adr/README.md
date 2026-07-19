# Architecture Decision Records (ADR)

`dax6` のファームウェア / ビルド環境 / tooling に関するアーキテクチャ意思決定を軽量ADRとして記録するディレクトリ。

## 位置づけ

- **ADR**: なぜその決定に至ったか（判断根拠・代替案・トレードオフ）
- **`CLAUDE.md`**: 現在の確定仕様・挙動・手順（"what/how"）
- **`docs/encoder-tuning-learnings.md`** 等: 試行錯誤の過程・学びの記録

ADRは決定の凍結ポイントを残し、CLAUDE.md はその決定を反映した最新仕様を保持する。役割分担は [ADR-0001](./0001-adopt-adrs.md) を参照。

## 起票ルール

起票が必要な条件、更新運用は `CLAUDE.md` の「ADR運用ルール」節を参照。

## テンプレート

新規ADRは [`_template.md`](./_template.md) をコピーして作成する。ファイル名は `NNNN-<slug>.md`（4桁連番 + 英小文字ハイフン）。

## Index

| # | タイトル | Status | 日付 |
|---|---|---|---|
| [0001](./0001-adopt-adrs.md) | Adopt ADRs for architectural decisions | Draft | 2026-07-11 |
| [0002](./0002-migrate-trackball-driver-to-paw3222.md) | Migrate trackball driver from PMW3610 to PAW3222 | Draft | 2026-06-18 |
| [0003](./0003-pin-west-yml-revisions-to-shas.md) | Pin west.yml module revisions to commit SHAs | Draft | 2026-02-17 |
| [0004](./0004-encoder-parameter-selection.md) | Encoder parameter selection (tap-ms / triggers-per-rotation / SCRL_VAL) | Draft | 2026-01-31 |
| [0005](./0005-macgesture-cursor-leak-workaround.md) | MacGesture cursor leak workaround via zip_xy_scaler | Draft | 2026-06-20 |
| [0006](./0006-hold-tap-use-standard-mt.md) | Use standard &mt for hold-tap (supersedes Karabiner-style kht) | Draft | 2026-02-28 |
| [0007](./0007-migrate-build-env-to-nix.md) | Migrate build environment from Docker to Nix | Draft | 2026-01-25 |
| [0008](./0008-in-house-keymap-editor.md) | In-house keymap editor (structural limitations of ZMK Studio) | Draft | 2026-06-25 |
| [0009](./0009-migrate-from-dax3.md) | Inherit firmware assets from dax3 to bootstrap dax6 | Draft | 2026-07-20 |
