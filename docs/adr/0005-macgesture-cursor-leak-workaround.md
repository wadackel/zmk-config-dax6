# ADR-0005: MacGesture cursor leak workaround via zip_xy_scaler

## Context

PR #16（2026-06-12）で mouse gesture サポートを導入した際、`kot149/zmk-mouse-gesture` モジュールを `west.yml` に追加し、`trackball_listener` に input-processor として組み込んだ。Mouse レイヤーで 2 つのジェスチャセットを提供する設計とし、`;+o` で history navigation（`Cmd+[` / `Cmd+]` 等）、`;+i` で macOS trackpad emulation（F11 / Mission Control / App Exposé / Spotlight）を発火させた。cursor 追従を止めるため両パスとも `suppress-movement` を有効化した。

MacGesture layer（`;+i` 発火時に active になる layer 7）で **カーソルが漏れる** 事象が発生した。Mouse layer の `;+o`（base chain 経由）は `suppress-movement` が効き、MacGesture layer の `;+i`（layer override chain 経由）だけが効かない、という非対称。

原因は ZMK 本体側のバグ:

```c
// zmk/app/src/pointing/input_listener.c:210-231
for (size_t oi = 0; oi < cfg->layer_overrides_len; oi++) {
    ...
    if (mask & BIT(0) && zmk_keymap_layer_active(layer)) {
        int ret = apply_config(...);
        if (ret < 0) { return ret; }
        if (!override->process_next) {
            return 0;   // ← ここ。ret ではなく 0 (CONTINUE) を返している
        }
    }
    ...
}
return apply_config(cfg->listener_index, &cfg->base, ...);  // base 側は ret を返す
```

`ZMK_INPUT_PROC_STOP = 1` を processor が返しても、layer override 分岐は `return 0`（CONTINUE）で握りつぶす。base chain の分岐は `return apply_config(...)` で正しく伝搬する。この非対称が Mouse layer と MacGesture layer の挙動差を生んでいた。

一次ソース: commit `490c33a`, `ctx` session `a13cc2e4` (events `e0036f2b`, `0a7b4a2e`), PR #16

## Decision

**`zip_xy_scaler 0 1` を override chain 末尾に追加して X/Y 値を 0 に潰す** workaround を採用する。

- `boards/shields/dax6/dax6_R.overlay` の `mac_gesture_override` を次のチェーンに変更:
  ```
  <&zip_xy_transform (XY_SWAP | Y_INVERT)>, <&zip_mouse_gesture_mac>, <&zip_xy_scaler 0 1>
  ```
- `zip_mouse_gesture_mac` から `suppress-movement` を外す（STOP ではなく CONTINUE を返させて後段 scaler に到達させる）
- `zip_xy_scaler 0 1` は `zmk/app/src/pointing/input_processor_scaler.c:23-43` で X/Y の value を 0 に書き換えて CONTINUE。HID には移動量 0 のレポートが流れてカーソルは静止する

**なぜ upstream パッチではなく workaround を選んだか**:

upstream の根治は `return 0;` を `return ret;` に変える1行修正で済むが、これを取り込むには次のいずれかが必要:

1. dax6 の `west.yml` を ZMK main（あるいは fork）に差し替える → v0.3 で安定運用している他モジュール（`zmk-rgbled-widget`, `zmk-driver-paw3222`）の互換性が壊れる。ADR-0003 の SHA pin ポリシーとも整合しない
2. ローカル patch を維持する → メンテナンス負担が発生し、他 ZMK ユーザとの共有もできない

対する `zip_xy_scaler` は ZMK 内蔵の既存 processor（`zmk/app/dts/input/processors/scaler.dtsi:26-32`）を使うだけで、`west.yml` にも本体コードにも手を入れない。個人リポで v0.3 に留まる方針との整合を優先し、workaround を採用した。

代替案として (3) `process-next` を有効化して override chain を貫通させ base chain 側の正しい伝搬に乗せる案も検討したが、base chain 側の `zip_mouse_gesture` も走ってしまい `;+i` の意味が変わるため不採用。

## Consequences

- MacGesture layer 中はカーソルが完全停止、ジェスチャ判定は async キュー経由で動作継続
- 実装箇所は `boards/shields/dax6/dax6_R.overlay` の `mac_gesture_override` のみ、副作用スコープは MAC_GESTURE layer に閉じる
- ZMK v0.3 のまま運用可能、SHA pin ポリシー ([ADR-0003](./0003-pin-west-yml-revisions-to-shas.md)) と整合
- 同種の layer_overrides + suppress-movement パターンを他 layer で使う場合、同じ workaround を末尾に足す必要がある（未来の Claude セッション向けメモ）

## Status

`Accepted`（2026-06-20）

## Superseded-by

-

## Follow-ups

- ZMK upstream に PR 提出（未実施、任意）。取り込まれれば workaround を外して chain を簡潔化できる

---

Related learnings: -
