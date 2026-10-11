# ADR-0011: DYA Studio support via cormoran ZMK fork and runtime sensor rotate

## Context

キー割当は ZMK Studio で実行時に変更できるが、エンコーダー割当とトラックボール調整は `config/dax6.keymap` / `dax6_R.overlay` の編集 → Nix ビルド → フラッシュが必要だった。設定アプリの自作も検討したが、[DYA Studio](https://github.com/cormoran/dya-studio) と cormoran 製の ZMK モジュール群が同じ要求を既に満たしており、DYA 以外の機体でも「公式 ZMK Studio 対応 + 対応モジュール」で使える（`dya-studio/README.md`、`src/content/developerGuide.ts`）。

DYA Studio の拡張機能は custom Studio RPC を使うため、upstream ZMK ではなく cormoran の fork が要る。採用可否を縛った事実（いずれも 2026-10-11 にソースとビルドで確認）:

| 事実 | 出典 |
|---|---|
| fork には ZMK v0.3 系のブランチ `v0.3-branch+custom-studio-protocol` がある。upstream v0.3.0 との差は `app/src/studio/`・`app/src/split/`・`ble.c`・`event_manager`・`app/west.yml`（`zmk-studio-messages` の差し替え）で、input-listener・pointing・behaviors・ボード定義は無変更 | `cormoran/zmk` wiki "Available Custom Studio RPC aware Branches"、`diff -rq` |
| `zmk-behavior-runtime-sensor-rotate` は CI が `v0.3-branch+custom-studio-protocol` を対象にしている | 同モジュール `west/west-dependency/west-test-dependency.yml` |
| `zmk-module-runtime-input-processor` の HEAD は v0.3 でビルドできない。依存する `zmk-feature-custom-settings` が Kconfig の `configdefault` と `zephyr_linker_sources(ROM_SECTIONS ...)` を使い、どちらも Zephyr 3.5 が受け付けない | ローカルビルドのエラー |
| 同モジュールは `e643dfe`（2026-05-01）で ZMK main の API（`zmk_keymap_layer_activate` の 2 引数化）へ移行した。その親 `dbf92f76`（2026-02-24）は v0.3 でビルドできる | `git log -G`、ローカルビルド |
| `dbf92f76` には後に修正された不具合が残る。変更通知が processor id を持たず常に id 0 で飛ぶ（`input_processor_runtime.c:693-694`）ため、DYA Studio は複数 processor の表示を取り違える。`set_xy_swap_enabled` の case に `break` がなく `set_x_invert` へ落ちる（`custom_handler.c:152-154`） | 当該ソース |
| rsr の setter は RAM 更新直後に `settings_save_one` する。試用してからキャンセルする経路はない | `behavior_runtime_sensor_rotate.c:137` |
| rsr の binding 既定 `tap-ms` は 5。DYA Studio は割当を変えるとき、そのレイヤーの現在の `tap_ms` を引き継いで送る | binding yaml、`dya-studio/src/components/SensorRotationConfig.tsx:134-151` |

## Decision

ZMK を cormoran fork の v0.3 系に切り替え、エンコーダー割当だけを DYA Studio から実行時に変更できるようにする。トラックボール調整（runtime input processor）は今回入れない。

| 決定 | 理由 |
|---|---|
| `zmk` を `cormoran/zmk` の `b227a48d`（`v0.3-branch+custom-studio-protocol`）に固定 | Zephyr 3.5 / `seeeduino_xiao_ble` / 既存モジュールの固定をそのまま使える。main 系（Zephyr 4.1）への移行は flake、ボード名、全モジュールの revision、CI を同時に動かすことになり、得られる機能に対して過大 |
| DYA 統合ブランチ `v0.3-branch+dya` は使わない | hold-tap、`behavior_input_two_axis.c`（`&msc` の実体）、endpoints、activity まで変更しており、既存の挙動への影響範囲が読めない |
| `zmk-behavior-runtime-sensor-rotate` を `8b1125ed` で追加し、全レイヤーの `sensor-bindings` を rsr の behavior に置き換える | runtime 設定は、そのレイヤーの sensor-binding が rsr に解決されるときだけ参照される。一部のレイヤーだけ rsr にすると DYA Studio で編集できないレイヤーが残る |
| `&enc_scroll` / `&inc_dec_kp` を廃止し、`rsr_scroll` / `rsr_scroll_rev` / `rsr_hscroll` / `rsr_vol` / `rsr_bri` の `cw-binding` / `ccw-binding` に従来の割当を写す | rsr は引数を取らないので、方向ごとの既定値は behavior ノード側が持つ。従来の `<&enc_scroll A B>` は cw=A / ccw=B と 1:1 に対応する |
| rsr の behavior は `&kp` 系も含めすべて `tap-ms = <20>` | `&msc` は 16 ms 周期で、それ未満の tap ではスクロールが出ない（[ADR-0004](./0004-encoder-parameter-selection.md)）。DYA Studio は現在値を引き継ぐので、既定 5 のレイヤーに後から `&msc` を割り当てると無反応になる。`&kp` を 20 ms で tap しても実害はない |
| `&msc_input_listener` の Android override と trackball のチェーンは変更しない | rsr は `&msc` の上流を差し替えるだけで、反転・3/5 倍率・ジェスチャの構造には触れない |
| custom RPC の payload 上限・RX/TX バッファ・RPC スレッドのスタックを引き上げる | 既定の payload 上限 25 B は rsr の set-binding 要求とほぼ同じ大きさ。9 レイヤー分の一覧取得は既定スタックに対して余裕が小さい。値は DYA Studio 開発者ガイドの推奨から rsr に関係するものだけを採った |
| runtime input processor は入れない | v0.3 で使える `dbf92f76` は通知 id の不具合で複数 processor の表示が壊れる。直すには自前 fork が要る。トラックボール調整は ZMK main 系への移行と合わせて入れる |
| `CONFIG_ZMK_STUDIO_LOCKING=n` は維持 | 編集のたびに unlock キーを押さない、という既存の運用を変えない |

レイヤー構成、combo、input-processor チェーンは [ADR-0010](./0010-ble-profile-driven-os-overlay-layer.md) から不変。

## Consequences

- `dax6_R` は FLASH 274,356 B（34.00%）/ RAM 81,348 B（31.03%）。変更前は 268,972 B / 77,650 B。`dax6_L` と `settings_reset` もビルドが通る。
- fork は split の BLE サービスにも手を入れているため、左右とも書き込み直す。
- `config/west.yml` の `zmk` が upstream ではなくなった。upstream v0.3 の修正は fork が取り込むまで届かない。fork の v0.3 系は 2026-02-10 が最終コミットで、作者の主力は main 系。差分は 22 ファイル規模なので、放置された場合は自前で持てる。
- `sensor-bindings` は `<&rsr_scroll>, <&rsr_scroll_rev>` の形になった。回転方向ごとの割当を keymap で変えるときは、レイヤーではなく behavior ノードの `cw-binding` / `ccw-binding` を編集する。
- DYA Studio で保存した割当は flash に残り、以後は keymap の既定値より優先される。keymap を書き換えてフラッシュしても、保存済みのレイヤーには反映されない。既定値に戻すには `settings_reset` を書き込む（BLE のボンドも消える）。
- 実機（USB 接続）で DYA Studio から `dax6` として接続でき、9 レイヤー・44 キーと 2 つのエンコーダーの割当が keymap の既定値どおりに読めること、割当の書き込みが読み戻しで確認できることを 2026-10-11 に確かめた。
- `tools/tester` の Sensors タブは rsr の behavior を解決して CW / CCW を表示し、`&msc` を使う behavior ごとに tap-ms を検査する形に改めた。旧形式（`&enc_scroll A B`）の経路は削除した。

## Status

`Draft` (2026-10-11)

## Superseded-by

-

## Follow-ups

- エンコーダーを実際に回したときの挙動と、電源を入れ直した後に保存済みの割当が残ることは未確認。
- BLE 経由の DYA Studio 接続（Android Chrome は BLE のみ）は未検証。`CONFIG_ZMK_STUDIO_LOCKING=n` では fork の `ZMK_STUDIO_LOCK_BLE_DIRECT_ADVERTISING_ON_UNLOCK` が無効になり、ホストと接続済みの間は広告が出ないため、ブラウザから見つからない可能性がある。有効にする場合は `&studio_unlock` の配置が要り、LOCKING=n のままだと一度 unlock した後は広告が止まらない。
- トラックボール調整の実行時変更。ZMK main 系への移行と合わせて `zmk-module-runtime-input-processor` の採用を再検討する。v0.3 に留まるなら `dbf92f76` に通知 id と `xy_swap` の修正を当てた fork が要る。
- PAW3222 の CPI の実行時変更。ドライバーは `paw32xx_set_resolution()` を公開しているが、RPC と永続化は無い。

---

Related learnings: -
