# ADR-0002: Migrate trackball driver from PMW3610 to PAW3222

## Context

dax6.2 基板ではトラックボールセンサーが **PMW3610 (kumamuk-git/zmk-pmw3610-driver)** から **PAW3222 (PixArt, sekigon-gonnoc/zmk-driver-paw3222)** に変更された。回路ラベル (SCLK / SDIO / CS / MOTION) は同名で、XIAO nRF52840 + 3線 SPI + MOTION 割り込みという構成も同等。しかし driver の設計思想が大きく異なる:

- **PMW3610 driver**: `CONFIG_PMW3610_ORIENTATION_*` / `CONFIG_PMW3610_INVERT_X` / `CONFIG_PMW3610_INVERT_Y` / `CONFIG_PMW3610_SCROLL_LAYERS` / `CONFIG_PMW3610_AUTOMOUSE_LAYER` など、挙動チューニングを **driver Kconfig** で持つ
- **PAW3222 driver**: raw `INPUT_REL_X` / `INPUT_REL_Y` のみを発行し、方向補正・スクロール変換・レイヤー連動 Kconfig は一切持たない

つまり PMW3610 で `dax6_R.conf` に集約されていた挙動設定を、そのままの構造で PAW3222 に移すことができない。

一次ソース: commit `0a43ac8`, PR #18, `ctx` session `0480cc61`

## Decision

driver を PAW3222 に切り替え、挙動チューニングは **ZMK の input-processor チェーン**（`trackball_listener` の下）で実装する。

- `west.yml` の driver モジュールを `sekigon-gonnoc/zmk-driver-paw3222` に差し替え、`revision` は `df652881`（ZMK v0.3 互換性を最終確認した SHA）に固定
- `boards/shields/dax6/dax6_R.overlay` の `trackball_listener` を input-processor チェーンで組む:
  - **default chain**: `<&zip_xy_transform 0>, <&zip_mouse_gesture>`
  - **scroll_override** (Scroll レイヤー = 5): `<&zip_xy_transform 0>, <&zip_xy_to_scroll_mapper>, <&zip_scroll_transform 0>, <&zip_scroll_scaler 1 64>`
  - **mac_gesture_override** (MAC_GESTURE レイヤー = 7): `<&zip_xy_transform 0>, <&zip_mouse_gesture_mac>`（この chain のカーソル漏れ対応は [ADR-0005](./0005-macgesture-cursor-leak-workaround.md)）

実機で決定した tuning values:

| Knob | Value | 根拠 |
|---|---|---|
| `res-cpi` | `1400` | PAW3222 driver range 608–4826 の中で実機トライアンドエラー |
| `zip_xy_transform` flags | `XY_SWAP \| Y_INVERT` | 90° CCW 物理マウント補正。処理順は swap → invert（`input_processor_transform.c:48-66`）。ball right → sensor Y+ → swap で code X, value=+ → invert なし → cursor right ✓ の物理検証 |
| `zip_scroll_transform` flags | `Y_INVERT` | macOS natural scroll 方向合わせ |
| `zip_scroll_scaler` | `1 64` | `1 4` の baseline は macOS 上で 8x 速すぎたため 64 分の1 に減衰 |

dax6.1 (PMW3610) の旧ファームウェアはタグ `pmw3610` に退避し、再ビルド可能状態を残す。

## Consequences

- PAW3222 に統一されたことで driver Kconfig 集の複雑さがなくなり、挙動設定は `boards/shields/dax6/dax6_R.overlay` の input-processor 一覧で全て見える
- 日常仕様の管理は `CLAUDE.md` の「PAW3222 トラックボール」節に集約
- Scroll レイヤー移動時の入力変換は `scroll_override` 経由になり、旧 `scroll-layers` の `highest_layer_active()` 問題（上位レイヤー同時 active 時に判定が外れる）から解放された
- dax6.1 基板（PMW3610）は `pmw3610` タグからビルド可能。ただし CI 自動ビルドは main 追随なので dax6.1 用ファームは手動タグビルドが必要

## Status

`Accepted`（2026-06-18）

## Superseded-by

-

## Follow-ups

- dax6.1 (PMW3610) の `pmw3610` タグからの再ビルド動作確認（PR #18 のテスト計画で唯一残った未消化項目）

---

Related learnings: -
