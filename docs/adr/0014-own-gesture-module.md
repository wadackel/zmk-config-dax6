# ADR-0014: Replace zmk-mouse-gesture with a layer-selected gesture processor

## Context

マウスジェスチャーは `kot149/zmk-mouse-gesture` を 3 インスタンス使っていた（通常、MacGesture レイヤー、Android）。Android 用には X/Y を RX/RY に付け替える回り道（[ADR-0010](./0010-ble-profile-driven-os-overlay-layer.md)）、MacGesture 用には `zip_xy_scaler 0 1` でカーソルを止める回り道（[ADR-0005](./0005-macgesture-cursor-leak-workaround.md)）があった。どちらも「layer override の中では `ZMK_INPUT_PROC_STOP` が握り潰される」ことへの対処だった。

設定アプリ（daxial）でジェスチャーの調整値とパターンを実行時に書き換えたい（daxial の issue #2, #8）。既存モジュールはパターンをビルド時に固定の表として持つ作りで、fork して載せ替えるより、書き換える前提で作り直す方が素直だと判断した。

確かめた事実:

| 事実 | 出典 |
|---|---|
| layer override は STOP を握り潰すが、イベントの値の書き換えは base chain と HID まで届く | `input_listener.c:199, 228-233` |
| 既存モジュールの認識の本体は 1 ファイル 674 行。4 方向、ストロークごとの累積、即時発火、発火後の待ち | `zmk-mouse-gesture/src/input_processors/input_processor_mouse_gesture.c` |
| dax6 の 3 インスタンスは、調整値がすべて同じ | 移行前の `config/dax6.keymap` |

## Decision

`wadackel/zmk-dax-modules` に `dax,input-processor-gesture` を自作し、`zmk-mouse-gesture` を外す。

| 決定 | 理由 |
|---|---|
| 処理は base chain に 1 つだけ置き、ジェスチャーの組（プロファイル）をアクティブなレイヤーで選ぶ | 3 インスタンスと override ごとの配置が要らなくなる |
| 上のレイヤーの組が勝つ。同じレイヤーに複数あるときは `require-layers` を満たす最初のもの | 「Gesture を保持」と「Gesture を保持、かつ Android が有効」を、同じキーで出し分けられる |
| カーソルは、値を 0 にして止める | override の中でも効く。RX/RY の付け替えと `zip_xy_scaler 0 1` が不要になる |
| `&mouse_gesture`（ジェスチャーを有効にする専用の behavior）を無くし、Gesture レイヤー（9）の保持で代替する | 仕組みが「レイヤー」だけになる。キーの位置と押し方は変わらない |
| ジェスチャー 1 つにつき behavior は 1 つ | dax6 の割当はすべて 1 つ。複数の操作はマクロに任せる |
| 認識の本体を ZMK に依存しない C の関数として切り出す | PC 上で単体テストできる |
| 認識のしかたと既定値は既存モジュールと同じにする | 置き換えで感触を変えない |
| 実行時編集（custom-settings への載せ替え）は次の段階に分ける | まず置き換えだけを実機で確かめる |

## Consequences

- `trackball_listener` のチェーンは 4 本から 3 本になった。`mac_gesture_override`、`zip_xy_to_gesture_axis` / `zip_gesture_axis_to_xy`、`zip_mouse_gesture_android` は無い。`AGENTS.md` の「3 点セット」の注意書きも不要になった。
- レイヤーが 1 つ増えて 10 個になった（Gesture = 9）。
- `config/gestures.dtsi` にジェスチャーの定義を分けた。native_sim のテスト（`tests/gestures`）が同じ定義を読む。
- native_sim で確かめたこと: Gesture を保持して左 → Cmd+[、MacGesture を保持して左 → Cmd+Space、Android が有効な状態で Gesture を保持して左 → Android の戻る、何も保持しない → カーソル移動がそのまま出る。モジュール側のテストで、組の優先順位、`require-layers`、キーを離したときの発火、ホイールに触らないことを確かめた。
- `dax6_R` は FLASH 361,920 B（44.85%）/ RAM 140,664 B（53.66%）。
- ADR-0005 は Superseded。ADR-0010 のうち、RX/RY の付け替えに関する部分はこの ADR で置き換える（BLE プロファイル連動のレイヤーそのものは有効）。

## Status

`Draft` (2026-10-11)

## Superseded-by

-

## Follow-ups

- 実機での感触の確認が未実施。ストロークの長さ、発火のタイミング、ジェスチャー中にカーソルが止まること、Scroll レイヤーと Android レイヤーの組み合わせ。
- 調整値・組・パターンの実行時編集（custom-settings への載せ替えと daxial の画面）。
- モジュールの binding に vendor prefix（`dax`）を登録する。ビルド時に警告が出る。

---

Related learnings: -
