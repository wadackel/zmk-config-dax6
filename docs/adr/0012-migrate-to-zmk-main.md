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
| `zmk-module-runtime-input-processor` の get 要求は `xy_swap_enabled` と `xy_to_scroll_enabled` を返さない（変更通知には入る） | `custom_handler.c:336-361`、実機 |
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
| 自作のモジュール（OS レイヤー、PAW3222 の CPI 設定）を `wadackel/zmk-dax-modules` に切り出し、`config/west.yml` から SHA で参照する | dax5 や今後の機体と共有する。repo ごとにコピーを抱えると当て漏れが起きる |
| `ZMK_BEHAVIOR_LOCAL_ID_TYPE_CRC16` は設定しない | モジュールの README は推奨するが理由がソースに無い。切り替えると behavior の番号が全部変わる |
| `zmk-behavior-runtime-sensor-rotate` は `8b1125ed` のまま | main 系でビルドできた。custom-settings へ移す PR #7 は未マージ |

## Consequences

- `dax6_R` は FLASH 361,352 B（44.78%）/ RAM 141,144 B（53.84%）。v0.3 系は 274,356 B / 81,348 B。`dax6_L` と `settings_reset` もビルドが通る。
- 2026-10-11 に左右へ書き込み、USB 経由の RPC で次を確かめた（daxial の `pnpm verify:device` と `pnpm test:device`）。9 レイヤー・44 キーが読める。接続直後に「未保存」が立たない。エンコーダー割当が 2 つとも全レイヤー分読める。`pointer` は XY 入替と X 反転、`scroll` は Y 反転と 1/64 で、devicetree の既定値どおり。CPI は 1400（範囲 608〜4826）。combo は 4 つが既定値として読める。`esc_lang2` はスロット 0 に入っている。各設定の RAM への書き込みと破棄、combo の追加・編集・破棄、マクロの作成・ステップ追加・削除が動く。
- native_sim のテスト（`tests/`）で次を確かめた。`tb_pointer` と `tb_scroll` の出力が、置き換え前の固定の処理と一致する。実行時 combo の既定値が発火し、`layers = <0 1>` の絞り込みが期待どおり働く。`esc_lang2` の親指キーが tap で ESC → LANG2、hold でレイヤー切り替えになる。
- 左右とも書き込み直す。v0.3 系で保存した設定は behavior の番号が合わなくなるおそれがあるので、先に `settings_reset` を書く（BLE のボンドも消える）。
- ボード名が `xiao_ble//zmk` になった（Justfile、`build.yaml`）。CI の reusable workflow は upstream main の SHA に固定した。
- combo は `config/dax6.keymap` の `runtime_combo_defaults` に書く。`tools/tester` の editor は `zmk,combos` を前提にしていて読めないため、[ADR-0013](./0013-retire-tools-tester.md) で `tools/tester` ごと削除した。
- 保存したことのない既定値のマクロ（`esc_lang2`）は、アプリで編集して Discard しても編集が残っていた。flash に記録が無く、設定レジストリの discard には戻す先が無いため。`zmk-dax-modules` `0379076` で、discard のあと devicetree の内容を書き戻すようにした（`CONFIG_ZMK_DAX_MACRO_DEFAULTS`、既定で有効）。2026-10-13 に実機で、起動直後は未保存と報告されること、ステップを足して Discard すると元の 2 ステップに戻り未保存の印も消えることを確かめた。cormoran の `zmk-feature-runtime-macro` には手を入れていない。
- fork は upstream main から 59 コミット遅れている（2026-10-11 時点）。split の入力レポートのデッドロック修正（upstream #3110）などは fork が取り込むまで届かない。

## Status

`Draft` (2026-10-11)。combo の部分（`zmk-feature-runtime-combo` の採用）は 2026-10-17 に ADR-0015 で覆した

## Superseded-by

`ADR-0015`（combo の部分のみ）

## Follow-ups

- 打鍵と体感の確認が未実施（RPC では確かめられない）。キー入力・レイヤー・combo の発火・`esc_lang2` のキー・トラックボールの向きと速さ・Scroll レイヤー・マウスジェスチャー・エンコーダー・BLE プロファイル 3 の Android レイヤーが移行前と同じに動くことを確認する。
- `&to` で Android レイヤーが落ちないことを確かめ、ADR-0010 と `AGENTS.md` の「`&to` は使わない」を見直す。
- `zmk-mouse-gesture` の新しい `suppress-movement` を前提に、Android 用の RX/RY の付け替えと MacGesture の `zip_xy_scaler 0 1` を外せるか検討する。
- エンコーダーの `triggers-per-rotation`、マウスジェスチャーの調整値とパターンは実行時に変えられない。ジェスチャーは専用のモジュールを自作する方針（daxial の issue #8）。
- `zmk-dax-modules` は private。GitHub Actions のビルド（`build.yml`）は既定のトークンでは取得できないので、公開するか、取得用のトークンを用意するかを決める。
- `esc_lang2` は settings reset の直後にスロット 0 へ入ることを確かめた。既定値のマクロを増やすと、この前提が崩れる。アプリで `esc_lang2` の名前を変えるとスロットが変わるので、その場合は keymap の `&esc_lang2_with_layer 4 0` の 0 を直す。

---

Related learnings: -
