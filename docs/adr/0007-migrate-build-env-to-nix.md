# ADR-0007: Migrate build environment from Docker to Nix

## Context

初期のビルド環境は公式 ZMK の Docker ベース構成に依存していた:

- 初回ビルドが遅い（コンテナ pull + zephyr build）
- キャッシュ再利用が限定的（ccache がコンテナ境界を跨ぎにくい）
- macOS 側の Docker Desktop 依存で開発機を選ぶ
- direnv などのシェル連携も別途必要になり、環境構築の暗黙知が増える

一次ソース: commit `734f95f`, PR #3, `ctx` session `7853d0c0`

## Decision

**ローカル開発は Nix flake ベースに移行**する。CI（GitHub Actions）は公式 ZMK Docker workflow を維持し、ローカル / CI の二本立てとする。

- `flake.nix` で開発 shell と zephyr toolchain を宣言（`zephyr-nix` 統合）
- ビルドは `nix develop --command just <cmd>` で実行（対話型 shell に入る必要なし）
- ccache を Nix 環境内に統合、ホスト側の `~/.ccache` を活かして再ビルドを短縮
- Apple Silicon は `nix develop --system x86_64-darwin` で Rosetta フォールバック可能
- direnv 統合は撤去（Nix コマンド呼び出しに一元化）

CI 側は互換性・再現性の実績を優先して Docker workflow を残す。ローカルの改良で CI に手を入れないポリシー。

## Consequences

- 初回ビルド ~1 分、インクリメンタル 15–30 秒（Docker 比で大幅短縮）
- Docker Desktop 依存を撤去、macOS ネイティブツールチェインで完結
- Nix 環境非対応のマシン（Linux CI 想定など）でも公式 ZMK Docker workflow で同等結果が得られる
- ローカルと CI で 2 種類のビルド系を維持するコストが発生。ただし CI 側は公式 workflow に丸ごと乗るため保守コストは最小
- `nix develop --command` を経由しない直接コマンドは動かないため、`CLAUDE.md` に明記して習慣化

## Status

`Accepted`（2026-01-25）

## Superseded-by

-

---

Related learnings: -
