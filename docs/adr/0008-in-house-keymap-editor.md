# ADR-0008: In-house keymap editor

## Context

`config/dax6.keymap` 編集の効率化に ZMK Studio 採用を検討した。しかし ZMK Studio には構造的な制約があった:

- **Vial (QMK)** はキーマップ / combo / macro が最初から EEPROM 上のデータとして設計されている
- **ZMK** は逆で、keymap は **devicetree としてコンパイル時に焼き込まれる**。Studio の runtime keymap はその上に後付けされた例外レイヤーで、combos / macros / input processor（マウスジェスチャ）は静的な C 構造体のまま
- 結果として Studio では combos / macros / input-processor / sensor-bindings が **触れない**

dax6 は combos + macros + mouse gesture + encoder sensor-bindings を積極的に使う設計で、Studio でカバーできない領域が全体の実質半分を占めていた。加えて 44 キー配列と TRANSFORM（`12/12/14/6=44`, R3 は matrix cols c3..c8）を専用にハードコードできれば、汎用エディタより物理配列に忠実な UI を提供できる。

一次ソース: commit `6c5478e`, `ctx` session `096e99ff`, `23dde6d5`

## Decision

**`tools/tester/` 内に dev 専用の keymap editor を自作**する。

- `config/dax6.keymap` を実ファイル編集するローカル専用エディタ
- 起動: `just editor`（`http://localhost:5173/`）
- タブ構成: Layers / Combos / Macros / Behaviors / Sensors / MouseGestures
- 保存前に unified diff プレビュー
- devicetree parser (`app/lib/keymap-dt/`) が parse / serialize / lint を担い、キー数は `app/lib/matrix-mapping.ts` の `TRANSFORM` に一元化
- 初回保存で `bindings = <…>;` の空白が canonical 整形に正規化される（`serialize.ts` ヘッダ参照）。以降は round-trip 安定、`default_layer.grid.golden` fixture が canonical 出力を byte 単位で pin
- **dev 専用**: 本番 GitHub Pages ビルドからは editor 一式（islands + `/api/**`）が除外される（`vite-plugins/dev-only-routes.ts` + `app/server.ts` の ROUTES + `routes/index.tsx` の `import.meta.env.DEV` 分岐）。本番 `/` は tester（打鍵可視化、読み取り専用）を配信

## Consequences

- Editor + Tester が同居する `tools/tester/` は Vite + HonoX アプリで、node/pnpm バージョンは `.mise.toml` で管理
- 保存後のファーム反映は手動（`nix develop --command just build-target dax6_R`）。Studio のように wireless 反映はしない
- devicetree parser の保守コストが発生（`config/dax6.keymap` のフォーマット変更時に fixture 更新が必要）
- Studio 依存の場合に受け入れる必要のあった機能ギャップ（combos / macros / mouse gesture 非対応）を解消
- 44 キー配列にハードコードしているため、キーボードを別モデルに変える場合は editor 側の TRANSFORM 差し替えが必要

## Status

`Superseded`（2026-10-11）

## Superseded-by

ADR-0013

---

Related learnings: -
