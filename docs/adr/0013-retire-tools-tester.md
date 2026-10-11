# ADR-0013: Retire tools/tester in favor of daxial

## Context

`tools/tester` は、打鍵の可視化（tester、GitHub Pages で公開）と、`config/dax6.keymap` を直接書き換える dev 専用の editor（[ADR-0008](./0008-in-house-keymap-editor.md)）を同居させた Web アプリだった。dax 系の機体ごとに同じアプリを repo に抱えており、改善を各 repo へ当て直す手間と当て漏れが続いていた。

[ADR-0012](./0012-migrate-to-zmk-main.md) で combo とマクロを実行時設定のモジュールへ移した結果、editor の Combos / Macros タブは今の keymap を読めなくなった。設定の編集は、実機に直接書き込む [daxial](https://github.com/wadackel/daxial) が担うようになっている。

## Decision

`tools/tester` を削除する（daxial の issue #10）。

| 決定 | 理由 |
|---|---|
| editor を削除 | 日々の調整は daxial で実機に書ける。新しい combo・マクロ・入力処理の書き方へ追随させる保守の量に見合わない |
| tester（打鍵の可視化）も削除 | 今は使っていない。必要になったら作り直す |
| `deploy-tester.yml`、Justfile の `editor`、`.mise.toml` の node / pnpm を削除 | `tools/tester` だけが使っていた |

keymap の既定値（書き込み直後の初期状態）を変えるときは、`config/dax6.keymap` を手で編集する。

## Consequences

- repo から Node のツールチェーンが無くなった。ビルドに要るのは Nix の開発環境だけ。
- ADR-0008 は Superseded。ADR-0009 と ADR-0011 の `tools/tester` に関する記述は、当時の記録として残す。

## Status

`Draft` (2026-10-11)

## Superseded-by

-

## Follow-ups

- GitHub Pages（`https://wadackel.github.io/zmk-config-dax6/`）には最後に配信した tester が残る。main へ取り込んだあと、Pages を無効にするかを決める。
- 実機の設定を keymap の形で書き出す機能が要るようになったら、daxial 側に作る。

---

Related learnings: -
