# ADR-0009: dax3 からファームウェア資産を継承して dax6 を立ち上げる

## Context

dax6 は dax3 の後継として設計中の Split キーボード。KiCad ベースの物理仕様は L=23 / R=21 = 44 キーで、片手 4×7 マトリクス、Rotary Encoder が両サイドに 1 個、後の基板改版で PAW3222 トラックボールを R central 側に搭載する予定。ZMK ファームウェアや自作キーマップエディタ (`tools/tester/`) は dax3 (46 キー / 4×14 マトリクス / PAW3222 / 2 エンコーダー / 8 レイヤー) にほぼ同一の要件を持つため、資産流用が可能な状態にあった。

一次ソース: `~/.claude/plans/20260720T0027-dax6-migrate-from-dax3.md`（本移行の Plan/Impl 記録）、dax3 リポジトリ (`../zmk-config-dax3`) の現行 HEAD、KiCad プロジェクト `~/develop/keyboard/dax6/`。

## Decision

**dax3 リポジトリを一括複製して dax6 にリネームし、物理配列関連 (dtsi の keys 配列 / matrix_transform.map / config/dax6.json / config/dax6.keymap) だけを dax6 の 44 キー仕様へ書き換える方針**を採用した。以下の資産は dax3 と同一で流用する:

- `app/`（os_layer.c 含む ZMK モジュール）
- `flake.nix`, `flake.lock`, `justfile`, `build.yaml`（Nix build 環境）
- `config/west.yml`（依存 revision: zmk v0.3 / paw3222 df652881 / rgbled a3510c9d / mouse-gesture v1）
- `boards/shields/dax6/*.conf`, `Kconfig.*`, `zmk.yml`（naming だけ dax3→dax6）
- `boards/shields/dax6/dax6_R.overlay` の PAW3222 + SPI0 + trackball_listener + input-processor チェーン
- `tools/tester/` フレームワーク層（Vite + HonoX、`boards/dax6/` プロファイル追加のみ）
- 8 レイヤー構成（default / Symbol / Num / Function / Mouse / Scroll / Device / MacGesture）と combos / macros / behaviors / mouse-gesture root

書き換え箇所:

| 箇所 | dax3 | dax6 |
|---|---|---|
| キー数 | 46 | 44 |
| Row 3 のマトリクス | RC(3,2..8) + RC(3,11) = 8 | RC(3,3..8) = 6 |
| default_layer 削除 bindings | — | `&mo 5` (RC(3,2)), `&kp SPACE` (RC(3,11)) |
| tester matrix.ts TRANSFORM row 3 | `[2,3,4,5,6,7,8,11]` | `[3,4,5,6,7,8]` |
| 物理座標 (dtsi keys 配列 / dax6.json) | dax3 KiCad 由来 | dax6 KiCad から抽出 (17mm=100 units, R を L の右に配置) |
| 命名 | dax3 / dax3_R / dax3_L | dax6 / dax6_R / dax6_L |

Alternative: (1) 段階移植 — 依存見落としリスクで却下。(2) dax3 fork — dax6 の独立性・視認性を優先し却下。

## Consequences

- 実装工数は 1 セッションで完結（実装 9 タスク + Final gate）。dax3 の 8 レイヤー + input-processor チェーンをそのまま使えたため keymap 再構成に集中できた。
- ビルドは `nix develop --command just build` 成功、`build/{dax6_R,dax6_L,settings_reset}.uf2` の 3 UF2 を生成。
- Vite + HonoX の tester は 44 キー配列に対応 (`app/boards/dax6/` プロファイル 11 ファイル + `__fixtures__/dax6.keymap` + `default_layer.grid.golden` を再生成)。31 test files / 256 tests all pass。
- 移行時に見つかった落とし穴: rsync `--exclude=zephyr` が git-tracked `zephyr/module.yml` (dax3 側の module 記述子) を巻き添えにし、dax6 側の初回ビルドが Kconfig 再帰エラーで失敗。`zephyr/module.yml` と `tools/tester/codegen/zmk-keycodes.ts` (`--exclude=zmk-*` に catch されていた) を明示的にコピーして解消。
- 継承した既存 ADR (0001..0008) は dax6 でもそのまま適用され、Related learnings も dax3 側の docs を参照する形で有効性を維持する。
- dax3 から継承していた tsconfig の @types/node 未指定に起因する tsc --noEmit の 75 errors を同時に解消。`@types/node ^26.1.1` を devDependency に追加し、`tools/tester/tsconfig.json` の `types` に `"node"` を追加。派生して露見した 5 件の pre-existing 型不整合（`app/core/editor-state/context.tsx` の存在しない `Dispatch` import、`patch-container.test.ts` の invalid pattern `'U'`、`bt-special-form.test.ts` の template literal、`nav-rail.tsx` の import path 誤り、`server.ts` の ROUTES 型ブリッジ）も同一 PR 内で修正し、`tsc --noEmit` exit 0 を達成。

## Status

Draft — 2026-07-20

## Superseded-by

-

## Follow-ups

- 実機 PCB 版で PAW3222 モジュールが物理搭載されたら `dax6_R.overlay` の pinctrl / CS / IRQ ピンを再確認する。KiCad schematic 上は SCLK=P1.13, SDIO=P1.15 (3-wire), CS=P0.10, MOTION=P1.12 で dax3 と同一を仮置き済。

---

Related learnings: `../encoder-tuning-learnings.md`, dax3 リポジトリ `/Users/wadackel/develop/github.com/wadackel/zmk-config-dax3`
