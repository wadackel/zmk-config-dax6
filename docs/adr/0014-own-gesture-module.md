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
| 認識したストロークと発火の通知、「描いた形を記録する」要求だけは、`dax_gesture` の独自の RPC にする。中身は数バイトの生のバイト列で、protobuf の定義は足さない | 設定の読み書きでは表せない（イベントと一時的なモード）。通知は入力スレッドからキューに積み、低優先度のワークキューから送る |
| 調整値・組・ジェスチャーを custom-settings（`dax_gesture`）に載せ、keymap の値を既定値にする。設定のための独自の通信定義は作らない | アプリ側は汎用の設定の読み書きだけで済む。未設定のスロットには、起動後に既定値を RAM 上で書き込んでアプリから読めるようにする |

## Consequences

- `trackball_listener` のチェーンは 4 本から 3 本になった。`mac_gesture_override`、`zip_xy_to_gesture_axis` / `zip_gesture_axis_to_xy`、`zip_mouse_gesture_android` は無い。`AGENTS.md` の「3 点セット」の注意書きも不要になった。
- レイヤーが 1 つ増えて 10 個になった（Gesture = 9）。
- `config/gestures.dtsi` にジェスチャーの定義を分けた。native_sim のテスト（`tests/gestures`）が同じ定義を読む。
- native_sim で確かめたこと: Gesture を保持して左 → Cmd+[、MacGesture を保持して左 → Cmd+Space、Android が有効な状態で Gesture を保持して左 → Android の戻る、何も保持しない → カーソル移動がそのまま出る。モジュール側のテストで、組の優先順位、`require-layers`、キーを離したときの発火、ホイールに触らないことを確かめた。
- `dax6_R` は FLASH 373,692 B（46.31%）/ RAM 143,736 B（54.83%）。
- 2026-10-11 に右手側へ書き込み、USB 経由の RPC で確かめた。調整値・組 3 つ・既定のジェスチャー 9 個が keymap のとおり読める。RAM への書き込みと破棄（既定のジェスチャーの復元を含む）、保存、既定のジェスチャーの削除が動く。レイヤーは 10 個として読める。
- 2026-10-11 に、認識の通知と「描いて登録」を実機で確かめた（`zmk-dax-modules` `2e1c6be`）。Gesture / MacGesture のキーを保持して描くと、その組のストロークと発火が届く。形の記録は、複数ストロークの形（例: → ← → ↓）を手を止めて 0.8 秒で確定し、開始から 7 秒たってから描き始めても記録でき、何も描かなければ 15 秒で空のまま終わる。実機で見つけて直した不具合は 2 つ: 即時発火のジェスチャーでストロークの通知が出ない、ボールに少し触れて止まると記録が空で終わる。
- 設定リセットのあと、右手側が起動直後に止まる不具合が出て、直した（`zmk-dax-modules` `145d778`）。保存済みのジェスチャーが無いと、起動時に既定値 9 個を custom-settings に書き込み、そのたびに Studio の通知が出る。ポートを開いているプログラムが無いと 256 バイトの送信バッファが 6 件目で満杯になり、送信が戻らず system work queue ごと止まっていた。既定値を書き込む間は通知を抑止する。直した版では、起動から 40 秒ポートを開かずに置いたあとの溜まった通知が 368 バイト以上から 108 バイト（マクロの既定値 2 件のみ）に減り、全項目が読めることを確かめた。
- ADR-0005 は Superseded。ADR-0010 のうち、RX/RY の付け替えに関する部分はこの ADR で置き換える（BLE プロファイル連動のレイヤーそのものは有効）。

## Status

`Draft` (2026-10-11)

## Superseded-by

-

## Follow-ups

- 実機での感触の確認が未実施。ストロークの長さ、発火のタイミング、ジェスチャー中にカーソルが止まること、Scroll レイヤーと Android レイヤーの組み合わせ。

---

Related learnings: -
