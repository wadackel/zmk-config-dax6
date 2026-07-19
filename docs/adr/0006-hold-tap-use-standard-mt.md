# ADR-0006: Use standard &mt for hold-tap (supersedes Karabiner-style kht)

## Context

親指キー `&mt LEFT_GUI LANG2` の hold-tap 挙動を Karabiner-Elements 相当に近づけたいという要求があった。Karabiner の理想挙動:

- 素早くタップ → `LANG2`（英数）
- 他キーと組み合わせ → 即座に `Cmd+key`（`lazy: true` 相当）
- 長押し後に他キーを押さずリリース → `LANG2`（`to_if_alone` 相当）

これに対して標準 `&mt`（`balanced` flavor / 160ms）は他キーの press + release を待ってから hold 判定するため、ショートカット発火が体感で遅い。

PR #14（2026-02-23）でカスタム behavior `kht`（karabiner_hold_tap）を導入した:

```dts
kht: karabiner_hold_tap {
    compatible = "zmk,behavior-hold-tap";
    #binding-cells = <2>;
    flavor = "hold-preferred";      // lazy:true 相当
    tapping-term-ms = <100>;         // to_if_held_down_threshold_milliseconds
    quick-tap-ms = <0>;
    retro-tap;                       // to_if_alone 相当
    bindings = <&kp>, <&kp>;
};
```

しかし運用してみると副作用が判明した:

- **LANG1 と LANG2 で hold-tap 挙動が不一致**: LANG1 側は既存の `&mt`（balanced / 160ms）のまま。左右親指の挙動が非対称で混乱
- **`retro-tap` は tapping-term 超過後も modifier を OS に未送信で保留**: 外部マウスの物理クリックと組み合わせた `Cmd+Click` などが不可（`&mkp` キー経由なら OK だが、外部マウス使用時に体感で困る）

一次ソース: PR #14 (kht 追加), PR #15 (mt へ戻し), `CLAUDE.md` の削除済節（commit `3820446` → `2dded32`）

## Decision

**カスタム `kht` を廃止し、標準 `&mt`（`balanced` flavor / `tapping-term-ms=160`）に統一する**。

- 対象キー: default_layer / Android / Windows のいずれの layer でも `&mt LEFT_GUI LANG2` パターン
- 選定した flavor / タイミング: `balanced` は他キーの press + release を待ってから hold 判定するため誤 modifier の抑制が強い。tapping-term 160ms は LANG1 側の既存 `&mt LEFT_SHIFT SPACE` と揃える
- 撤回対象: PR #14 で導入した `kht` behavior 定義と、default / Android / Windows レイヤーの `&kht` 呼び出しを全て `&mt` に置換
- 諦めた要件: Karabiner 完全互換（`lazy:true` + `to_if_alone`）による Cmd+key ショートカットの即時発火。ここは LANG1/LANG2 の挙動一貫性と外部マウス物理クリック（`Cmd+Click`）の併用性を優先して受容する

## Consequences

- 左右親指の hold-tap 挙動が揃い、認知負荷が減る
- 外部マウスとの `Cmd+Click` が復活
- `Cmd+key` ショートカット発火は 160ms 待つ体感になる（Karabiner 比では遅い）。ただし macOS の Karabiner なしで完結する構成の代償として受容
- PR #14 で採用した `kht` は本ADRで撤回。`CLAUDE.md` からも該当節を削除済み

## Status

`Accepted`（2026-02-28）

## Superseded-by

-

---

Related learnings: -
