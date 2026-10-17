# ADR-0015: Runtime-editable combos matched by ZMK's combo code

## Context

macOS の cmd+tab を、いつもの cmd キー（左親指の `&mt LEFT_GUI LANG2`、balanced、`tapping-term-ms = <160>`）と E+R の combo（→ TAB）で操作したい。combo は daxial で編集できるままにし、ZMK 標準の `zmk,combos` と同じに振る舞わせたい。cormoran のモジュールへの upstream 変更は出さない。

[ADR-0012](./0012-migrate-to-zmk-main.md) で採った `zmk-feature-runtime-combo` では、cmd キーを押して 160ms 以内に combo を押すと、cmd の付かない TAB の後に LANG2 が出た。

確かめた事実:

| 事実 | 出典 |
|---|---|
| ZMK はイベントを、listener のリンク順に渡す。順番はソートされない | `zmk/app/include/linker/zmk-events.ld:14` |
| モジュールのソースは `app` に ZMK 本体より先に足される。本体は hold-tap を `:52`、combo を `:70`、keymap を `:77` で足す（いずれも central のときだけ） | `zephyr/CMakeLists.txt:670-682`、`zmk/app/CMakeLists.txt:48,52,70,77` |
| 移行前の `zmk.map` では、cormoran の combo が hold-tap より先にキーを受け取っていた | `build/dax6_R/zephyr/zmk.map` の `zmk_event_sub_*zmk_position_state_changed` |
| cormoran の combo だけを hold-tap の後へ並べ替えると、素早い cmd+E+R が cmd+E / cmd+R になり、`&lt` の直後の打鍵で文字が入れ替わった。判定が、hold-tap が預かって送り直すキーを扱えない | この決定のための実験（native_sim） |
| 同じ配置を `zmk,combos` にすると、どの場合も期待どおりだった。ZMK の判定は、2 つ目以降のキーとキーを離したときのイベントを送り直して、hold-tap の順序を保つ | 同上、`zmk/app/src/combo.c:263-278,459-470` |
| `zmk/app/src/combo.c` は `zmk,combos` のノードが無いと空になる | `zmk/app/src/combo.c:28,538` |

## Decision

`wadackel/zmk-dax-modules` に `CONFIG_ZMK_DAX_COMBO` を作り、dax6 の combo をそちらに移す。

| 決定 | 理由 |
|---|---|
| 判定は ZMK の `src/combo.c`（`cormoran/zmk` の `1fc72aaf`）の写し（`src/combo/combo_engine.c`）。表だけを保存した設定から作る | 判定が標準と同じコードなので、標準の combo と同じに振る舞い、ZMK の combo のテスト 25 件がそのまま使える |
| 写しで変えるのは、表を実行時に作ること、`require_prior_idle_ms` を 32 bit に、listener 名を `dax_combo` に、ファイルスコープを `static` に、の 4 点。1 つの combo のキー数の上限（`MAX_COMBO_KEYS`）は、最長の combo ではなく Kconfig の最大値にする | ZMK を更新するとき、元の `combo.c` と diff を取れる。保存値が 65535 まで入る。ZMK の `combo.c` とシンボルが衝突しない（仮想キー位置は同じ番号から数えるので、`zmk,combos` のノードとは併用しない） |
| CMake で、判定のソースを `app` のソースの `src/combo.c` の直前へ移す | 標準の combo と同じ位置（hold-tap の後、keymap の前）に置く手段が、これ以外に無い |
| 保存の形式と通信は `zmk-feature-runtime-combo`（`d9490e7`）を、名前だけ `dax_combo` / `dax.combo` に変えて写す。key 数の下限は 2 ではなく 1 | daxial の画面と API を、通信先と生成コードの差し替えだけで使い続けられる。下限 1 は ZMK の標準に合わせた |
| 表は system workqueue で作り直す。きっかけは `zmk_custom_settings_initialized` と、`dax_combo` のすべての変更（SAVED を含む）。combo のキーを押している間は、全部離すまで待つ | キーのイベントと combo の時間切れも同じ queue で動くので、ロックが要らない。PERSIST の書き込みと reset は SAVED しか出さない。押下中に表を差し替えると、押している combo の番号がずれる |
| key position が keymap の範囲外の combo は表に入れない | 判定は key position を配列の添字に使う |
| E+R → TAB をスロット 4 の既定値に足す（`layers = <0 1>`、`require-prior-idle-ms = <150>`） | 150 は、打鍵中の e r を抑止し、cmd を押さえたままの連打は通すことをシミュレーターで確かめた値 |
| 前の案（`dax,behavior-hold-macro` で cmd と AppSwitch レイヤーを保持する）は取り下げる。モジュールの behavior は残す | cmd をいつもの位置のまま使いたい。標準の combo の振る舞いなら、押さえている修飾キーがすべて TAB に掛かるので、逆送りも shift の親指キーで出せる |

採らなかった案:

- cormoran の combo を写して判定を直す: 判定の違いが複数ある（キーを離したときの送り直しが無い、時間切れの基準が今の時刻、候補の選び方が別）。洗い出して直すのは書き直すのと変わらない
- 並び順の入れ替えだけ: 上の実験のとおり壊れる
- E+R だけ `zmk,combos`: daxial で編集できない
- 通信を汎用の custom settings RPC にする: daxial の combo の API と画面を、保存形式を組み立てる形に書き直すことになる
- 保存済みの combo を引き継ぐ: ユーザーの判断で引き継がない

### zmk-dax-modules が依存してよいもの

今後の改修にも適用する。

- 依存してよい: cormoran のモジュールの `include/` にある公開ヘッダ、devicetree の binding、proto、Kconfig
- 依存しない: `src/` の static 関数、設定の保存場所や形式の推測、ZMK 本体の内部構造
- 公開 API で足りないとき: パッチを当てずに、`dax_` を付けた名前で丸ごと取り込み、compatible も変える。west.yml の SHA を更新するとパッチは消え、同じ compatible の実装が 2 つあると衝突するため
- 依存した API と前提にした挙動を ADR に書き、west.yml を更新するときの確認項目にする

この決定は ZMK の内部に 2 か所依存する。どちらも `zmk` を更新するときに確かめる。

1. `combo_engine.c` は `1fc72aaf` の `app/src/combo.c` の写し。新しい `combo.c` と diff を取り、判定の変更を取り込む
2. CMake は `app` のソースにある `src/combo.c` を目印にする。名前が変わると、ビルドが FATAL_ERROR で止まる

## Consequences

- `zmk-dax-modules` に `src/combo/`（判定・保存・通信）、`proto/dax/combo/`、`dax,runtime-combo-defaults` の binding、native_sim のテスト 33 件が増えた
  - `tests/combo-zmk/`: ZMK の combo のテスト 25 件。snapshot は ZMK のまま。保存形式に 1 時間が入らないので、3 件だけ待ち時間を 65535ms にした
  - `tests/combo/holdtap-quick-modifier`: 素早い cmd+E+R が cmd+TAB になり、LANG2 は出ない。期待値は同じ keymap を `zmk,combos` で流した出力。`zmk-feature-runtime-combo` ではこのテストが落ちた
  - `tests/combo/pending-rebuild`: 押している combo の割当を変えても、離すまで古い割当で動く。押下中も作り直す実装では落ちた
  - cormoran のテスト 4 件。仮想キー位置の番号は表の並び（キー数の少ない順）で数えるようになり、同じ配置の `zmk,combos` と一致した
- `dax6_R` の `zmk.map` で、`dax_combo` は `behavior_hold_tap` と `keymap` の間に並ぶ
- `config/west.yml` から `zmk-feature-runtime-combo` を外し、`zmk-dax-modules` を `babdfba3`（dax combo を入れた main）に付け替えた
- `dax6_R` は FLASH 374,912 B（46.46%）/ RAM 145,000 B（55.31%）
- DYA Studio からは combo を編集できない
- combo の通信は、gesture と同じく Studio のロックの対象（`SECURED`）。dax6 は `CONFIG_ZMK_STUDIO_LOCKING=n` なので、daxial の操作は変わらない
- cormoran の combo で保存した値は flash に残るが読まれない。`settings_reset.uf2` で消える（BLE のボンドも消える）
- 文字を打ってから 150ms 以内に cmd を押さえて E+R を押すと、cmd+E / cmd+R になる
- 実機（2026-10-17）: macOS で、cmd の親指キーを押さえて E+R を押すとアプリが切り替わった。daxial から `er_tab` を編集して保存すると、ポートを開き直しても残り、既定値に戻すと 150ms に戻った。daxial の `pnpm test:device` が `dax_combo` を必須にして通った
- BLE プロファイル 3 を選んでいると、USB で Mac につないでいても Android レイヤーが有効になり、親指キーが HYPER（Ctrl+Opt+Shift+Cmd）を出す。cmd+tab が効かなかった原因はこれで、combo の判定ではなかった
- daxial が combo を書くと配列 3 本を順に書くので、途中の作り直しで、一瞬だけ新しいキーと古い割当の組み合わせになりうる

## Status

`Draft` (2026-10-17)

## Superseded-by

-

## Follow-ups

- 実機での確認が未実施: shift での逆送り、普段の入力で e r が TAB にならないこと、電源を入れ直しても保存した combo が残ること、起動後にポートを開かずに 40 秒置いてもキー入力が止まらないこと

---

Related learnings: -
