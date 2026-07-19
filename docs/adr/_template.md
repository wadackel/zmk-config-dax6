# ADR-NNNN: <タイトル>

## Context

意思決定を必要とした背景・制約・観測事実を書く。git commit や PR、ctx セッション、参照した外部資料などの一次ソースは冒頭または末尾にまとめる。

## Decision

採用した決定を「何を」「なぜ」の順で書く。代替案を検討した場合は簡潔に対比を残す。数値や設定値がある場合は表形式で並べる。

## Consequences

決定が **実現された** 効果・副作用・トレードオフを書く。実装後の実測結果や、以降の作業に影響するポイントを追記していく。

## Status

`Draft` | `Accepted` | `Superseded` | `Deprecated` のいずれか。日付（YYYY-MM-DD）を併記する。

## Superseded-by

このADRを覆した後続ADRの番号（例: `ADR-0012`）。まだ有効な場合は `-`。

## Follow-ups (任意)

未対応・継続監視項目を書く。完了したら Consequences に移動して本節から削除する。項目がない場合は本節ごと省略してよい。

---

Related learnings: <該当する learnings doc へのリンク、なければ `-`>

<!--
## 運用ノート（テンプレとして参照するときの手順）

1. `docs/adr/README.md` のインデックスを開き、次の連番（4桁）を決める
2. 本テンプレをコピーして `docs/adr/NNNN-<slug>.md` として保存（slug は英小文字 + ハイフン）
3. `# ADR-NNNN: ...` のタイトルを差し替え、5節（+ 任意 Follow-ups）を埋める
4. `Related learnings:` 行を必ず残す（該当なしは `-`）
5. `docs/adr/README.md` のインデックスに 1 行追加
6. 既存決定を覆す場合は、覆された旧ADRの Status を `Superseded` に、Superseded-by を新ADR番号に更新する
-->
