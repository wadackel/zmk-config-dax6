# ADR-0012: Migrate to ZMK main and adopt runtime settings modules

## Context

[ADR-0011](./0011-dya-studio-support.md) で ZMK v0.3 系の fork に切り替え、エンコーダー割当だけを実行時に変えられるようにした。その後、設定アプリを自作（[daxial](https://github.com/wadackel/daxial)）し、キー割当・エンコーダーに加えて、トラックボール調整・ジェスチャー・combo・マクロまで GUI で完結させる方針になった（daxial の issue #1, #2）。

採用可否を縛った事実（2026-10-11 にソースとビルドで確認）:

| 事実 | 出典 |
|---|---|
| cormoran の設定モジュール群（custom-settings、runtime-input-processor、runtime-combo、runtime-macro）は `cormoran/zmk` の `main+custom-studio-protocol` を対象に CI している | 各 repo の `west/west-dependency/west-test-dependency.yml` |
| `zmk-feature-custom-settings` は Zephyr 3.5 でビルドできない | ADR-0011 |
| `main+custom-studio-protocol`（`1fc72aaf`）は upstream main に対し、pointing・behaviors・endpoints・activity・keymap・combo を変更していない。Studio のメッセージ定義は v0.3 系の fork と同じ版（`89b81d2e`） | `git diff --stat`、`app/west.yml` |
| `main+dya` は hold-tap・tap-dance・`behavior_input_two_axis.c`・activity・keymap を変更している | 同上 |
| main 系の `input_listener.c` は、layer override が返した `ZMK_INPUT_PROC_STOP` を v0.3 系と同じく握り潰す。スムーズスクロールの分周が dead code である点、`&msc` が 1 ティックで端数を捨てる点も同じ | `input_listener.c:228-233, 267-270`、`behavior_input_two_axis.c:131-152` |
| main 系の `zmk_keymap_layer_activate` / `_deactivate` は `locking` 引数を取る。ロックして有効にしたレイヤーは、ロックなしの deactivate（`&to` を含む）では落ちない | `keymap.c:134-162, 227-235` |
| Zephyr 4.1 は SDK 0.17.0 を想定する。0.17.4 では picolibc の `locks.c` がコンパイルできない | `zephyr/SDK_VERSION`、ローカルビルドのエラー |
| runtime-input-processor は反転を「入替の前の軸」で判定する。`zip_xy_transform` は入替の後に反転する | `input_processor_runtime.c:870-891, 946-949` |
| runtime-macro の devicetree 既定値は、スロット番号がビルド時に決まらない | `cormoran,runtime-macro-default.yaml` |
| runtime-combo のレイヤーの絞り込みは、最上位のアクティブレイヤーだけを見る | `runtime_combo.c:910` |

## Decision

ZMK を main 系（Zephyr 4.1）へ移し、設定モジュールを 4 つ追加する。input-processor チェーンの構造は変えず、固定の処理を実行時に調整できる処理へ置き換える。

| 決定 | 理由 |
|---|---|
| `zmk` を `cormoran/zmk` の `1fc72aaf`（`main+custom-studio-protocol`）に固定 | 設定モジュールの CI 対象。本体の挙動に手を入れていない |
| `main+dya` は使わない | 既存の挙動（hold-tap、`&msc`）への影響が読めない |
| Nix の SDK を 0.17.0 に固定し、`nixpkgs` は据え置く | 0.17.4 ではビルドできない。新しい nixpkgs では zephyr-nix の Python 環境が評価できない |
| `os_layer.c` は Android レイヤーをロックして有効・無効にする | 新しい API が引数を要求する。ロックにより `&to` で落ちなくなる見込みで、ADR-0010 の制約を緩められる |
| `zip_xy_transform (XY_SWAP \| Y_INVERT)` を `tb_pointer`（`xy-swap-enabled; x-invert;`）に、`zip_scroll_transform (Y_INVERT)` + `zip_scroll_scaler 1 64` を `tb_scroll`（`y-invert`、1/64）に置き換える | 既定値は移行前と同じ結果になる。向き・倍率を実行時に変えられる |
| チェーンの構造（base / scroll / mac_gesture / android の 4 本、RX/RY の付け替え）は変えない | override が STOP を握り潰す挙動は main 系でも同じ。`zmk-mouse-gesture` は値を 0 にする方式に変わったので簡略化できる可能性があるが、カーソルの挙動は実機でしか確かめられないため、移行と同時には行わない |
| combo 4 つを `cormoran,runtime-combo-defaults` に移し、`zmk,combos` を削除 | 既存の combo を GUI で編集できるようにする。同じキーを両方が持つ場合の挙動は不明なので併用しない |
| マクロ `esc_lang2` を実行時マクロの既定値（`cormoran,runtime-macro-default`）に移し、hold-tap の tap 側を `&rmacro`、引数をスロット 0 にする | 中身を GUI で変えられることを優先する（daxial の issue #9）。既定値のスロット番号はビルド時に決まらないが、既定値が 1 つだけなら settings reset の直後は最初の空きであるスロット 0 に入る見込み。`wait-ms = <15>` は従来のマクロの既定の間隔に合わせた |
| `ZMK_BEHAVIOR_LOCAL_ID_TYPE_CRC16` は設定しない | モジュールの README は推奨するが理由がソースに無い。切り替えると behavior の番号が全部変わる |
| `zmk-behavior-runtime-sensor-rotate` は `8b1125ed` のまま | main 系でビルドできた。custom-settings へ移す PR #7 は未マージ |

## Consequences

- `dax6_R` は FLASH 361,352 B（44.78%）/ RAM 141,144 B（53.84%）。v0.3 系は 274,356 B / 81,348 B。`dax6_L` と `settings_reset` もビルドが通る。
- 左右とも書き込み直す。v0.3 系で保存した設定は behavior の番号が合わなくなるおそれがあるので、先に `settings_reset` を書く（BLE のボンドも消える）。
- ボード名が `xiao_ble//zmk` になった（Justfile、`build.yaml`）。CI の reusable workflow は upstream main の SHA に固定した。
- combo は `config/dax6.keymap` の `runtime_combo_defaults` に書く。`tools/tester` の editor は `zmk,combos` を前提にしているため、Combos タブでは編集できなくなった。
- fork は upstream main から 59 コミット遅れている（2026-10-11 時点）。split の入力レポートのデッドロック修正（upstream #3110）などは fork が取り込むまで届かない。

## Status

`Draft` (2026-10-11)

## Superseded-by

-

## Follow-ups

- 実機確認が未実施。左右を書き込み、キー入力・レイヤー・combo・トラックボールの向きと速さ・Scroll レイヤー・マウスジェスチャー・エンコーダー・BLE プロファイル 3 の Android レイヤーが移行前と同じに動くことを確認する。
- `&to` で Android レイヤーが落ちないことを確かめ、ADR-0010 と `AGENTS.md` の「`&to` は使わない」を見直す。
- `zmk-mouse-gesture` の新しい `suppress-movement` を前提に、Android 用の RX/RY の付け替えと MacGesture の `zip_xy_scaler 0 1` を外せるか検討する。
- PAW3222 の CPI、エンコーダーの `triggers-per-rotation`、マウスジェスチャーの調整値とパターンは実行時に変えられない。custom-settings に載せる自作モジュールが要る。
- `esc_lang2` がスロット 0 に入ることを、書き込み後にアプリのマクロ一覧で確かめる。違う番号なら、keymap の `&esc_lang2_with_layer 4 0` の 0 を直す。既定値のマクロを増やすと、この前提が崩れる。
- `tools/tester` の editor をどうするか（combo を読めるようにするか、daxial へ役割を寄せて畳むか）。

---

Related learnings: -
