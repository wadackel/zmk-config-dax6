# dax6 ZMK設定開発ガイド

## ビルド手順

ビルドコマンドは `nix develop --command` 経由で実行する。対話型シェルに入る必要はない。

```bash
# 初回セットアップ（westワークスペース初期化）
nix develop --command just setup

# 全ターゲットビルド
nix develop --command just build

# 特定ターゲットのみビルド
nix develop --command just build-target dax6_R
nix develop --command just build-target dax6_L

# ビルド成果物の削除
nix develop --command just clean

# 完全クリーンアップ（.west/, modules/ 等を含むワークスペース再構築用）
nix develop --command just pristine
```

ビルド成果物は `build/` に出力される:
- `build/dax6_R.uf2` - 右手側（トラックボール + ZMK Studio）
- `build/dax6_L.uf2` - 左手側
- `build/settings_reset.uf2` - 設定リセット用

## ディレクトリ構造

- `app/` - カスタム ZMK モジュール（os_layer.c, Kconfig）
- `boards/shields/dax6/` - Shield定義（dtsi, overlay, conf, Kconfig）
- `config/` - キーマップ（`dax6.keymap`）、`west.yml`、ZMK Studio用 JSON
- `tools/tester/` - キーマップテスター + keymap editor Webアプリ（Vite + HonoX、editor は dev 専用）
- `docs/` - 詳細な学びのドキュメント
- `docs/adr/` - アーキテクチャ意思決定記録（ADR）

## ADR運用ルール

`docs/adr/` に「なぜその決定に至ったか」を軽量ADRで集約する。CLAUDE.md本体（確定仕様）と `docs/encoder-tuning-learnings.md`（試行錯誤の学び）とは役割を分ける。詳細は [ADR-0001](./docs/adr/0001-adopt-adrs.md) を参照。

### 起票が必須の条件

以下の変更を含む場合は必ずADRを起票する:

1. **driver モジュールの追加 / 削除 / 切替**（例: PMW3610 → PAW3222）
2. **`west.yml` の revision 変更**（tag → SHA 昇格、外部モジュールのバージョン更新を含む）
3. **ZMK upstream バグへの workaround 採用**（本体変更を避ける実装選択）
4. **Zephyr / Kconfig の deprecation 対応方針**（例: `CONFIG_NFCT_PINS_AS_GPIOS` → DT `nfct-pins-as-gpios`）
5. **ハードウェア pin 配置 / 回路構成の変更**
6. **ビルドシステム変更**（例: Docker → Nix）
7. **キーマップ全体アーキテクチャ変更**（レイヤー追加 / 削除を伴う設計、input-processor チェーン再構築）
8. **既存決定を覆す変更**（Supersede 判定）

### 起票が任意の条件

以下は判断に応じてADRを起票する（数値チューニングは通常 CLAUDE.md 側で管理）:

- 電源管理の設計値変更、外部モジュール採用、tooling 追加

### 起票手順

1. `docs/adr/README.md` のインデックスで次の連番を確認
2. `docs/adr/_template.md` をコピーして `docs/adr/NNNN-<slug>.md` として保存
3. 5節 + 任意 Follow-ups + `Related learnings:` 行を埋める
4. `docs/adr/README.md` インデックスに1行追加

### Superseded 運用

既存決定を覆す場合は新ADRを作成し、旧ADRの Status を `Superseded` に、Superseded-by を新ADR番号に更新する。

### Consequences vs Follow-ups の使い分け

- **Consequences**: 実装後に **実現された** 効果・副作用（realized）
- **Follow-ups**: 未対応・継続監視項目（not-yet-done）
- **完了時**: Follow-ups 項目が実現したら Consequences に移動して Follow-ups から削除する

### Related learnings リンク運用

該当する learnings doc（例: `docs/encoder-tuning-learnings.md`）があれば末尾の `Related learnings:` 行にリンクする。なければ `-`。ADR ↔ learnings の相互リンクを構造的に維持することで役割分担のドリフトを防ぐ。

### テンプレ変更時

`_template.md` を変更した場合、既存ADRを新フォーマットに追随更新する。フォーマットのバージョン不整合を残さない。

## ハードウェア仕様

### Split キーボードアーキテクチャ

- 全 44 キー、左右非対称 (L=23, R=21)。各サイド 4×7 マトリクス、統合 default_transform 上では 4×14 で col-offset=7 により R を後半カラムに配置。
- Row 別内訳: Row 0 = 12 キー / Row 1 = 12 / Row 2 = 14 / Row 3 = 6（thumb cluster、L cols 3..6 + R cols 7..8）。
- エンコーダ 2 個 (Alps EC12E、L=`left_encoder`, R=`right_encoder`)、電源スライドスイッチ (MSK-12D19) は KiCad 上の SW100 でファーム外扱い。
- `dax6_R`（右手）が **central**。キーマップ・レイヤー管理・トラックボールを担当
- `dax6_L`（左手）が **peripheral**。エンコーダ入力のみ、レイヤー関連の設定は不要
- keymap に関わる設定は `dax6_R.conf` のみに記述する

### PAW3222 トラックボール

R central 側に PAW3222 (PixArt) を搭載する構成。KiCad の現行 dax6 PCB にはトラックボール footprint は未実装だが、SPI0/MOTION/CS/SDIO/SCLK ネットは配線済で、後の基板改版で PAW3222 モジュールを追加する前提でファーム側は dax3 同一の SPI + input-listener チェーンを維持する。PMW3610 とは異なり、ドライバ自体は orientation / invert / scroll-layers のような Kconfig を持たず、raw `INPUT_REL_X` / `INPUT_REL_Y` のみを発行する。挙動チューニングは ZMK の input-processor チェーンで行う (`boards/shields/dax6/dax6_R.overlay`)。

#### 構成の全体像

`trackball_listener` (`zmk,input-listener`) の input-processors チェーン:

- **default chain** (全レイヤー共通の起点): `<&zip_xy_transform 0>, <&zip_mouse_gesture>`
  - 物理方向 → ユーザ視点方向への補正を最初に通し、その後マウスジェスチャを判定する
- **scroll_override** (Scroll レイヤー = 5 のみ): `<&zip_xy_transform 0>, <&zip_xy_to_scroll_mapper>, <&zip_scroll_transform 0>, <&zip_scroll_scaler 1 4>`
  - `zip_xy_to_scroll_mapper` が X→HWHEEL, Y→WHEEL に変換 (PMW3610 の `scroll-layers` 相当)
  - `zip_scroll_scaler 1 N` の分母 N で粗さ調整 (大きいほどゆっくり)
- **mac_gesture_override** (MAC_GESTURE レイヤー = 7): `<&zip_xy_transform 0>, <&zip_mouse_gesture_mac>`

#### Transform flag の意味

`<&zip_xy_transform FLAGS>` の `FLAGS` は `<dt-bindings/zmk/input_transform.h>` のビット OR:

- `INPUT_TRANSFORM_XY_SWAP` — X と Y を入れ替え
- `INPUT_TRANSFORM_X_INVERT` — X 軸反転
- `INPUT_TRANSFORM_Y_INVERT` — Y 軸反転

`zip_scroll_transform` も同じビットを使う (`INPUT_REL_WHEEL` / `INPUT_REL_HWHEEL` に対して効く)。

PMW3610 の `CONFIG_PMW3610_ORIENTATION_180` + `CONFIG_PMW3610_INVERT_X` + `CONFIG_PMW3610_INVERT_Y` の net 効果は `x = -raw_x, y = raw_y` で、PAW3222 で再現するなら `<&zip_xy_transform (INPUT_TRANSFORM_X_INVERT)>` 相当 (実機調整必須)。

#### CPI / 感度

CPI は DTS の `res-cpi` プロパティで設定 (`res-cpi = <1000>` で PMW3610_CPI=1000 相当)。範囲は driver の `RES_MIN=608` 〜 `RES_MAX=4826` (`zmk-driver-paw3222/src/paw3222.c` の `RES_STEP * 16..127`)。

### ロータリーエンコーダ
- **型番**: EC11
- **steps**: 80 (1回転あたりのパルス数)
- **デテント数**: 24 (1回転あたりのクリック数)

## ZMKロータリーエンコーダ設定の絶対ルール

### ⚠️ 重大な制約

#### 1. `tap-ms`は16ms以上必須

```c
// config/dax6.keymap
enc_scroll: encoder_scroll {
  tap-ms = <20>;  // ✅ OK: 16ms以上
  // tap-ms = <10>;  // ❌ NG: スクロールが一切動かなくなる
};
```

**理由:**
- `&msc`（スクロール）の内部イベント周期は**16ms**
- `tap-ms < 16ms`だと押している間に**1回もイベントが出ずゼロ**になる
- 結果として**スクロールが完全に無反応**になる

**症状:**
- エンコーダ自体は動作する（音量調整などは反応する）
- スクロールだけが一切反応しない
- ビルドエラーは出ない（実行時の問題）

### 2. `triggers-per-rotation`は`steps`の整数約数から選ぶ

```dts
// boards/shields/dax6/dax6.dtsi
sensors: sensors {
  triggers-per-rotation = <40>;  // steps(80)の約数 = 2 pulses/trigger
};
```

**理由:**
- ZMK sensor は `steps ÷ triggers-per-rotation` の pulses を貯めて 1 回発火する（アキュムレータ方式）
- **非整数比だと休止からの最初の1デテントで閾値未満になり空振りする**
- 例: `24` に合わせると `80÷24=3.33 pulses/trigger`。EC11 の 1 デテントは物理的に 3〜4 pulses ぶれるので、最初のデテントが 3 pulses しか出ない場合 3.33 に届かず**初動が空振り**
- 整数比なら 1 pulse ぶれでも閾値到達が確実になる

**80 steps 環境での選択肢:**
- `40` → 2 pulses/trigger（**推奨**: 初動が半デテントで即発火、体感が最も軽い）
- `20` → 4 pulses/trigger（1 デテントで 1 発火弱、初動 1 デテントは空振りしやすい）
- `24`（=デテント数）→ 3.33 pulses/trigger、**非整数比のため初動空振りが起きる**（過去の推奨だが劣る）

**トレードオフ:**
- `40` は 1 デテントで 1.67 発火 → 速い回転でオーバースクロールしやすい
  - 相殺策として `SCRL_VAL` を下げる（デテント数一致設定の 170 相当 → 120 に）
- 1 デテント= 1 発火の見た目より、**「休止からの空振りゼロ」を優先した方が体感が明確に良い**

**誤解しやすいポイント:**
- 「デテント数に合わせる」は初動空振り問題を無視した簡略化ルール。整数比を優先する方が実運用で優れる
- 小さくすれば敏感になると思いがち（実際は逆で、1 発火に必要な pulses が増える）

### 3. スクロール速度は`SCRL_VAL`で調整

```c
// config/dax6.keymap
#define ZMK_POINTING_DEFAULT_SCRL_VAL 120
```

**理由:**
- 反応性は`triggers-per-rotation`で決まる
- スクロール量は`SCRL_VAL`で決まる
- **役割を分けて調整する**

**macOS環境の注意:**
- 60だと小さすぎてmacOSが認識しない
- 120以上が安全圏

**調整目安（triggers-per-rotation=40 前提）:**
- 速い→140-160、遅い→100
- `triggers-per-rotation` を 24 や 20 に変える場合、1 回転あたりの発火数が減るぶん `SCRL_VAL` を比例で上げる（40+120 で total 4800 が基準）

完全な動作設定は `config/dax6.keymap` と `boards/shields/dax6/dax6.dtsi` を参照。

## トラブルシューティング

### ZMK で OS を自動検出できるか？

**できない。** ZMK v0.3 に OS 自動検出機能は存在しない。USB HID descriptor 分析（QMK の `os_detection`）も
BLE GATT 経由の OS 識別も未実装。BLE profile ベースのマッピングが唯一の手段。

現状この仕組みは未使用。BLE profile 切り替えに連動して overlay レイヤーをアクティブ化するカスタム
モジュール `app/src/os_layer.c` と Kconfig `CONFIG_ZMK_OS_LAYER` は将来の再利用に備えて温存して
あるが、`dax6_R.conf` には `CONFIG_ZMK_OS_LAYER=y` を入れていないため `os_layer.c` はビルドから
除外される。再有効化したい場合は `dax6_R.conf` に `CONFIG_ZMK_OS_LAYER=y` と
`CONFIG_ZMK_OS_LAYER_PROFILE_N=<layer>` を加え、keymap に対応するオーバーレイレイヤーを書き戻せばよい。

### CI が `led_red alias not found` で失敗する

`zmk-rgbled-widget` の `revision: main` が更新され ZMK v0.3 互換性が壊れた可能性。
`config/west.yml` のリビジョンを ZMK v0.3 互換の commit hash にピン留めすること。

### zmk-rgbled-widget の互換性

ZMK v0.3 は `seeeduino_xiao_ble` ボード名を使用する。`zmk-rgbled-widget` は
2026-02-16 に ZMK main 用の `xiao_ble_zmk` に移行し、v0.3 互換性を削除した。
`revision: main` で CI が壊れるため、`config/west.yml` でピン留めする:

```yaml
- name: zmk-rgbled-widget
  remote: caksoylar
  revision: a3510c9d  # Last version compatible with ZMK v0.3 (seeeduino_xiao_ble)
```

ZMK を v0.3 から main に移行する際は、ボード名も `xiao_ble//zmk` に変更が必要。

### zmk-driver-paw3222 の互換性

`sekigon-gonnoc/zmk-driver-paw3222` は ZMK main を想定して開発されているが、現時点 (2026-06-15)
の最新 main (`df652881`) は ZMK v0.3 でビルド可能。`revision: main` 直当ては rgbled-widget と
同じく将来の破壊リスクがあるため `config/west.yml` で SHA をピン留めする:

```yaml
- name: zmk-driver-paw3222
  remote: sekigon-gonnoc
  revision: df652881  # Last version compatible with ZMK v0.3 (PAW3222 driver, verified 2026-06-15)
```

PAW3222 ドライバは raw `INPUT_REL_X` / `INPUT_REL_Y` のみ発行する設計のため、orientation /
invert / scroll-layers は **driver Kconfig ではなく ZMK input-processor** で実装する。
詳細は上の「PAW3222 トラックボール」節を参照。

### スクロールが一切反応しない

**チェック項目:**
1. `tap-ms`が16ms以上か？
   - → 20msに設定
2. `SCRL_VAL`が大きすぎないか？
   - → macOSでは120以上推奨
3. ファームウェアは左右両方フラッシュしたか？
   - → 両方フラッシュ必須

### ゆっくり回転すると反応しない

**原因:**
- `triggers-per-rotation`が非整数比で初動が空振りしている、または小さすぎる
- → `steps`(80) の整数約数 `40` に設定

### 速く回転するとバースト的にスクロール

**原因:**
- `tap-ms`が長すぎる（100msなど）
- → 20msに設定

## 現在のレイヤー構成

| 番号 | 名前 | 説明 |
|------|------|------|
| 0 | default_layer | デフォルト |
| 1 | Symbol | 記号 |
| 2 | Num | 数字 |
| 3 | Function | ファンクション・矢印 |
| 4 | Mouse | マウスボタン |
| 5 | Scroll | スクロールモード |
| 6 | Device | BLE設定 |
| 7 | MacGesture | macOS用マウスジェスチャ (Mouse layerから遷移) |

## CI / デプロイ

### ファームウェアビルド
- `.github/workflows/build.yml` - push/PR/手動トリガーで実行
- ZMK の reusable workflow（`zmkfirmware/zmk/.github/workflows/build-user-config.yml@v0.3.0`）を使用
- ビルド対象は `build.yaml` で定義（`build.yml` と混同しないこと）

### テスター + keymap editor (tools/tester)
- `.github/workflows/deploy-tester.yml` - main ブランチへのプッシュで自動デプロイ（手動トリガーも可）
- URL: `https://wadackel.github.io/zmk-config-dax6/`
- node/pnpm バージョンは `.mise.toml` で管理（source of truth）
- `tools/tester/package.json` の `packageManager` は corepack 互換のため同期して更新すること
- 依存追加時は `pnpm-lock.yaml` を再生成・コミットすること（CI は `pnpm install --frozen-lockfile`）

#### 2つのモード
- **Editor**（dev の `/`）: `config/dax6.keymap` を実ファイル編集するローカル専用エディタ。`just editor` で起動（`http://localhost:5173/`）。Layers/Combos/Macros/Behaviors/Sensors/MouseGestures タブ、保存前に unified diff プレビュー。**dev 専用** — 本番 GitHub Pages ビルドからは editor 一式（islands + `/api/**`）が除外され、`/` は tester を配信する（`vite-plugins/dev-only-routes.ts` + `app/server.ts` の ROUTES + `routes/index.tsx` の `import.meta.env.DEV` 分岐）。
- **Tester**（dev の `/tester`、本番 `/`）: 物理キー打鍵の可視化（読み取り専用）。

#### editor の実装メモ
- devicetree パーサ `app/core/keymap-dt/` が `config/dax6.keymap` を parse/serialize/lint。キー数は `app/boards/dax6/matrix.ts` の `TRANSFORM`（12/12/14/6=44、R3 は matrix cols c3..c8）に一元化。
- **初回保存で `bindings = <…>;` の空白が canonical 整形に正規化される**（以降は round-trip 安定、`serialize.ts` ヘッダ参照）。`default_layer.grid.golden` fixture が canonical 出力を byte 単位で pin。
- Sensors タブは `steps=80` を `triggers-per-rotation` で割り切れない場合に WARN を表示する。現行の実値 `40` は `80 % 40 = 0` の整数約数なので WARN は出ない（`24` に戻すと非整数比のため WARN が復活する）。
- 保存後のファーム反映は手動: `nix develop --command just build-target dax6_R`。

## 参考ドキュメント

- [ADR (Architecture Decision Records)](./docs/adr/README.md) - 意思決定の記録
- [詳細な学び](./docs/encoder-tuning-learnings.md) - 試行錯誤の過程と深い理解
- [ZMK Documentation](https://zmk.dev/)
