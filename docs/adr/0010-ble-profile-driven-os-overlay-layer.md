# ADR-0010: BLE profile driven OS overlay layer (Android)

## Context

`l` の位置に割り当てた BLE プロファイル 3 は Android スマホ用だが、キーマップは macOS 専用に組まれていた。マウスジェスチャの「戻る」が `LG(LEFT_BRACKET)`、左サムに `LEFT_GUI`、スクロール方向は macOS のナチュラルスクロール前提で、Android では噛み合わない。

dax3 から継承した `app/src/os_layer.c` に「`zmk_ble_active_profile_changed` を購読して対応レイヤーを `zmk_keymap_layer_activate()` する」機構が完成していたが、`CONFIG_ZMK_OS_LAYER` を有効化していないためビルドから除外されており、実際には一度もコンパイルされていなかった。

設計を縛った ZMK v0.3 の実装事実（いずれもソースで確認済み）:

| 事実 | 出典 |
|---|---|
| `&to` は全レイヤーを deactivate する | `zmk/app/src/keymap.c:214-222` |
| combo の `layers` フィルタは `zmk_keymap_highest_layer_active()` が返す最上位レイヤー 1 つだけを見る | `zmk/app/src/combo.c:164,169` / `keymap.c:184-193` |
| input-listener の override は `layers` の OR 条件のみ。宣言順に最初にマッチしたものが `process-next` なしなら base ごと打ち切る | `zmk/app/src/pointing/input_listener.c:204-231` |
| `zip_xy_transform` と `zip_mouse_gesture` は WHEEL/HWHEEL を無変更で素通しし、内部状態も汚さない | `input_processor_transform.c:44-68` / `zmk-mouse-gesture/src/input_processors/input_processor_mouse_gesture.c:496-499` |
| `K_BACK` は HID Keyboard page の仕様外拡張 0xF1 で Android は解釈しない。Consumer page 0x224 の `C_AC_BACK` を使う | `zmk/app/include/dt-bindings/zmk/keys.h:851,1346` |

## Decision

`CONFIG_ZMK_OS_LAYER=y` / `CONFIG_ZMK_OS_LAYER_PROFILE_3=1` を `dax6_R.conf`（central 側のみ）に入れ、プロファイル 3 に連動する常時アクティブな Android オーバーレイレイヤーを新設する。

| 決定 | 理由 |
|---|---|
| Android を **index 1**（default_layer の直上）に挿入し既存レイヤーを +1 | 最上位に置くと `highest_active_layer` が常に Android になり、combo 4 個のレイヤー限定が全レイヤーで無効化される。index 1 なら Symbol 以上を押している間は combo が正しく抑制される |
| combo の `layers = <0>` を `<0 1>` に | 非 Android 時 `highest=0` / Android 時 `highest=1` の両方を通す必要があるため |
| `&to 6` / `&to 0` を `&tog 7` に置換 | `&to` は常時 ON のオーバーレイも落とし、次のプロファイル変更まで復帰しない |
| `scroll_override` に `process-next` を付け、`android_override` を最後に宣言して WHEEL を反転 | override は AND 条件を書けない。専用の AndroidScroll レイヤーを増やす代わりに、Scroll チェーンの出力を後段で反転する。base のプロセッサはいずれも WHEEL を素通しするので非 Android 側の挙動は変わらない |
| Android のジェスチャ判定を base chain へ移し、`android_override` 側で X/Y を `INPUT_REL_RX` / `INPUT_REL_RY` に改名する | layer override は `ZMK_INPUT_PROC_STOP` を握り潰すため、`suppress-movement` が base chain でしか効かない。改名により (a) base の `zip_xy_transform` が二重適用されない、(b) macOS 用ジェスチャノードが Android のイベントを見ない、(c) Android 用ノードを base に置ける、が同時に成立する。RX/RY は `handle_rel_code()` の対象外なので base 末尾で X/Y に戻す |
| 左サム pos 39 は `&mt HYPER LANG2`（`HYPER = LC(LS(LA(LGUI)))`） | Android の GUI 単独は検索 / アシスタントに取られるが、4 修飾同時押しなら OS のショートカット照合に一致しない。修飾キー usage は HID の修飾バイトに乗るので tap しても文字は出ない。tap の LANG2 は macOS 側と同じ指の癖を保つため |
| エンコーダに `zip_scroll_scaler 3 5` を入れる | `SCRL_VAL` は 1 イベントの大きさではなく速度で、実測は 1 トリガあたり `REL_WHEEL = 1`（`120 × 16ms ÷ 1000 = 1.92` を切り捨て、端数はリリース時に破棄）。素の 1.67 notch/デテントは Android では 64dp と 128dp の交互ジャンプに見える。`3 5` で平均 1.0 notch/デテントに落とす。1 未満に割る以上、値 0 のトリガ（5 回中 2 回）は避けられない |
| `CONFIG_ZMK_POINTING_SMOOTH_SCROLLING` は使わない | v0.3 の `input_listener.c:260-262` が `scaled` を計算しておきながら `evt->value = val;` と未除算の値を代入しており、分周パスが dead code。加えて Linux/Android の hid-input は Resolution Multiplier を最大に設定したうえで REL_WHEEL を 16:1 に間引くため、多くの Android 端末では体感が大幅に遅くなる |
| エンコーダの反転は `&msc_input_listener` の layer override で行う | `&enc_scroll` は `&msc` に委譲し、`&msc` は自前の input-listener を持つ。レイヤーごとの `sensor-bindings` を複製せずに済み、`&inc_dec_kp` の音量・輝度には影響しない |
| `&msc_input_listener` の override と `#include <input/processors.dtsi>` は overlay ではなく `config/dax6.keymap` に置く | shield overlay は keymap より先に parse されるため、`behaviors.dtsi` 由来の `msc_input_listener` ラベルが overlay 時点では未定義。L 側ビルドにも `zip_scroll_transform` が必要 |
| `app/CMakeLists.txt` を `zephyr_library()` から `target_sources_ifdef(... app ...)` に変更 | 独立ライブラリだと ZMK 本体の `zmk/app/include` が include path に乗らず `zmk/ble.h` が解決できない。他の ZMK モジュール（zmk-mouse-gesture / zmk-rgbled-widget）と同じ流儀に揃えた |
| ジェスチャは左＝`C_AC_BACK` のみ。`always-active` は付けない | 右/上/下は必要になってから足す。macOS 側と同じく `&mouse_gesture` ホールド中のみ反応させる |

レイヤー構成: 0 default_layer / **1 Android** / 2 Symbol / 3 Num / 4 Function / 5 Mouse / 6 Scroll / 7 Device / 8 MacGesture。

## Consequences

- Android オーバーレイは pos 39 の `&mt HYPER LANG2` のみを定義する。pos 39 は他の全レイヤーで `&trans` なので衝突しない。OS 別の追加調整はこのレイヤーに足していけばよい。
- ジェスチャ中のカーソル停止は実現したが、代償として trackball のチェーンに 3 点セットの不変条件（`android_override` の `process-next` + 末尾マッパー / base の Android ノード + 復元マッパー / ノードの `event-code-x`,`event-code-y`）が生まれた。CLAUDE.md の「ジェスチャ中のカーソル停止」節に明記してある。
- `always-active` を持つノード（`zip_mouse_gesture_mac`）は `is_active` が per-device で恒久 true になるため、この手法では抑制できない。MacGesture レイヤーは [ADR-0005](./0005-macgesture-cursor-leak-workaround.md) の `zip_xy_scaler 0 1` を維持する。
- `&to` が keymap から消え、Device レイヤーの出入りは `&tog 7` になった。Device 以外にアクティブなレイヤーがあっても落とさなくなる。
- `dax6_R` の FLASH 使用量は 33.30%（268728 B）。os_layer.c 有効化と Android レイヤー追加込み。
- editor の `sections.ts` は named mouse-gesture ノードを名前の whitelist ではなく `zip_mouse_gesture_` 接頭辞で拾うようにした。以後 OS 別ジェスチャノードを足しても editor 側のコード変更は要らない。
- 起動直後は `settings_load()` 前なのでプロファイル 0 が読まれるが、プロファイル 0 は `-1`（割り当てなし）なので実害はなく、BLE 接続確立時のイベントで正しいレイヤーに補正される。
- Android 接続中は `zmk_keymap_highest_layer_active()` が 1 になるため、`CONFIG_RGBLED_WIDGET_SHOW_LAYER_CHANGE` のレイヤー表示もベース状態で 1 を示す。
- 実機で確認済み（2026-08-21）: Android のジェスチャは意図どおり動作し、ジェスチャ中のカーソルも止まった。トラックボールのスクロールも問題なし。エンコーダは `zip_scroll_scaler 3 5` で体感が合った。

## Status

`Draft` (2026-08-21)

## Superseded-by

-

## Follow-ups

- 検討したが不採用: ZMK v0.3 を fork して `input_listener.c` の `return 0;` を `return ret;` に直す根治案。同じバグに 2 度被弾しており（ADR-0005 と本 ADR）、fork なら dax3 時代の却下理由（`zmk/` は west clone で git 管理外、`west update` で巻き戻る）は解消する。fork リポジトリの維持と ADR-0003 の方針追記を避け、まず DTS のみで済む方法を採った。3 度目が来たら再検討する。
- 未確認: macOS 側のリグレッション有無。特に Scroll レイヤーに `process-next` を足したことによるトラックボールスクロールへの影響、combo 4 個、Device レイヤーの `&tog 7` 化。
- エンコーダの粒度は `zip_scroll_scaler 3 5` で平均 1.0 notch/デテント。トリガ列とデテント列は 1:1.67 で位相が合わないため、どの分数を選んでもデテントごとに完全一定にはならない。振り直すなら `1 2`（0.83）かスケーラ撤去（1.67）。
- 水平スクロール（HWHEEL）は反転していない。Android で違和感が出たら `android_override` / `android_encoder_override` の flag に `INPUT_TRANSFORM_X_INVERT` を足す。
- Android 接続中に Mouse レイヤーの `I`（`&mo MAC_GESTURE`）を押すと macOS 用ジェスチャが有効になる。Android レイヤー（index 1）は Mouse レイヤー（index 5）を上書きできないため。必要なら Mouse レイヤー側の設計を見直す。
- `os_layer.c` の `PROFILE_COUNT 5` は `ZMK_BLE_PROFILE_COUNT` とのハードコード重複。`CONFIG_BT_MAX_PAIRED` を変えると乖離する。

---

Related learnings: -
