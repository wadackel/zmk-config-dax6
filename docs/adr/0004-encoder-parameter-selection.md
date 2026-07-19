# ADR-0004: Encoder parameter selection

## Context

EC11 ロータリーエンコーダ（80 steps / 24 detent）を macOS ホストでスクロールに使う際、次の要求とハマりポイントがあった:

- **少ない回転で反応してほしい**（1 デテントで確実に発火）
- **速い回転でオーバースクロールしない**
- **`&msc`（mouse scroll）の内部イベント周期は 16ms**（`tap-ms < 16ms` だと押している間に 1 回もイベントが出ずゼロ）
- **`triggers-per-rotation` は steps の整数約数を選ばないと初動が空振り**（EC11 の 1 デテントは 3–4 pulses ぶれるため、非整数比だと閾値未達で発火しない）
- **macOS はスクロール量が小さいと認識しない**（`SCRL_VAL=60` で無反応）

一次ソース: `docs/encoder-tuning-learnings.md`, `ctx` session `ee8c6fc8`

## Decision

以下の3値を採用:

| パラメータ | 値 | 定義場所 | 根拠 |
|---|---|---|---|
| `tap-ms` | `20` | `config/dax6.keymap` の `enc_scroll` behavior | `&msc` の 16ms 内部周期を最低 1 回は跨げる最小値。10ms は無反応、100ms は複数イベントバースト |
| `triggers-per-rotation` | `40` | `boards/shields/dax6/dax6.dtsi` の `sensors` node | `80` の整数約数で 2 pulses/trigger。デテント数 24 に合わせると 3.33 pulses/trigger の非整数比になり初動が空振り。20 (4 pulses/trigger) は 1 デテント 1 発火より弱く体感で劣る |
| `ZMK_POINTING_DEFAULT_SCRL_VAL` | `120` | `config/dax6.keymap` の `#define` | macOS 認識下限（60 は無視される）。40 (`triggers-per-rotation`) × 120 = 4800/回転を「速度チューニングの基準単位」とする |

反応性は `triggers-per-rotation` で、スクロール量は `SCRL_VAL` で、バースト防止は `tap-ms` で調整する（役割分離）。

## Consequences

- 1 デテント = 1.67 発火となり、休止からの空振りゼロ + macOS で確実に認識される
- 速い回転時のオーバースクロールは `SCRL_VAL` の減衰で抑える（過去 230 → 120）
- `triggers-per-rotation` を変える場合、1 回転あたりの発火数が変わるので `SCRL_VAL` を比例調整する（合計 4800/回転を目安）
- 「デテント数に合わせる」という直感的なルールは初動空振り問題を無視した簡略化。整数比を優先する方針に統一

具体的な調整目安・macOS 環境特有の挙動・スムーズスクロール未実装の Trade-off は `docs/encoder-tuning-learnings.md` を参照。

## Status

`Accepted`（2026-01-31）

## Superseded-by

-

---

Related learnings: [docs/encoder-tuning-learnings.md](../encoder-tuning-learnings.md)
