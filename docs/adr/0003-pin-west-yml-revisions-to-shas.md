# ADR-0003: Pin west.yml module revisions to commit SHAs

## Context

`config/west.yml` に列挙する外部モジュールで `revision: main` の直当てをしていた時期、CI ビルドが上流の破壊的変更で突然壊れる事例が発生した:

- **2026-02-16 の `zmk-rgbled-widget` upstream 変更**: ZMK main への追従で board 名 `seeeduino_xiao_ble` サポートを削除、`xiao_ble_zmk` への一本化。dax6 は ZMK v0.3（`seeeduino_xiao_ble`）に留まっているため、次のビルドで `led_red alias not found` エラーとなり CI が red
- 復旧手段は「v0.3 互換の最終 commit SHA (`a3510c9d`) にピン留め」だった。同種の破壊リスクは他の外部モジュール（PAW3222 driver, mouse-gesture）にも常に存在する

一次ソース: `config/west.yml`, commit `fcfccec`, `CLAUDE.md` のトラブルシューティング節

## Decision

**全外部モジュールは commit SHA 固定を原則とする**。tag 参照は例外（メジャーバージョンが十分安定、または移行期の暫定手段）に限定する。

現在の pin 状況:

| モジュール | revision | 種別 | 理由 |
|---|---|---|---|
| `zmk` (zmkfirmware) | `v0.3` | tag | ZMK 本体はリリースブランチが安定運用されているため tag 参照可 |
| `zmk-driver-paw3222` (sekigon-gonnoc) | `df652881` | SHA | ZMK main 向けに開発されているが v0.3 互換性を確認した SHA に固定 |
| `zmk-rgbled-widget` (caksoylar) | `a3510c9d` | SHA | v0.3 (seeeduino_xiao_ble) 互換の最終 SHA |
| `zmk-mouse-gesture` (kot149) | `v1` | tag | **暫定**（Follow-ups で SHA 化予定） |

新規モジュール追加時のデフォルトは SHA 固定。tag 参照する場合は上表の「理由」列に相当する根拠を必ず記録する。

## Consequences

- モジュール更新は「revision 昇格の明示的な作業」になる。自動追随されないため、CI が上流変更で突然壊れることはない
- 反面、upstream の bugfix / セキュリティ修正も自動取り込みされない。手動で SHA を更新する運用が必要
- `flake.lock` と同様の「意図的に固定された依存」というモデルで、再現性・監査性が確保される
- ZMK main への将来的な移行時は、board 名 (`xiao_ble//zmk`) 変更 + `zmk-rgbled-widget` 実装差分吸収を同時に行う必要がある

## Status

`Accepted`（2026-02-17）

## Superseded-by

-

## Follow-ups

- **`zmk-mouse-gesture: revision: v1` → SHA 化**: tag 依存を解消。code review コメント（ctx session `0480cc61`）で NIT 指摘済み、未対応
- **ZMK v0.3 → main 移行時の対応**: board 名を `seeeduino_xiao_ble` → `xiao_ble//zmk` に変更、`zmk-rgbled-widget` を main 対応 SHA に切り替え、この2つは同時に実施する必要あり

---

Related learnings: -
