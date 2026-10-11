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

`docs/adr/` に「なぜその決定に至ったか」を軽量ADRで集約する。AGENTS.md本体（確定仕様）と `docs/encoder-tuning-learnings.md`（試行錯誤の学び）とは役割を分ける。詳細は [ADR-0001](./docs/adr/0001-adopt-adrs.md) を参照。

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

以下は判断に応じてADRを起票する（数値チューニングは通常 AGENTS.md 側で管理）:

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

R central 側に PAW3222 (PixArt) のトラックボールを搭載している。SPI0 + MOTION 割り込みで接続し、`trackball_listener` の input-listener チェーンで処理する。PMW3610 とは異なり、ドライバ自体は orientation / invert / scroll-layers のような Kconfig を持たず、raw `INPUT_REL_X` / `INPUT_REL_Y` のみを発行する。挙動チューニングは ZMK の input-processor チェーンで行う (`boards/shields/dax6/dax6_R.overlay`)。

#### 構成の全体像

`trackball_listener` (`zmk,input-listener`) の input-processors チェーン:

`tb_pointer` と `tb_scroll` は実行時に調整できる処理（`zmk,input-processor-runtime`、後述）。`WHEEL_INV` は `(INPUT_TRANSFORM_Y_INVERT)` の略記。

- **base chain**: `<&tb_pointer>, <&zip_mouse_gesture>, <&zip_mouse_gesture_android>, <&zip_gesture_axis_to_xy>`
  - 物理方向 → ユーザ視点方向への補正を最初に通し、その後マウスジェスチャを判定する
  - ジェスチャノードが 2 つ並ぶのは、`suppress-movement`（= `ZMK_INPUT_PROC_STOP`）が base chain でしか伝搬しないため。macOS 用は X/Y、Android 用は RX/RY を読むので互いのイベントを見ない
  - 末尾の `zip_gesture_axis_to_xy` は Android chain の RX/RY を X/Y に戻す。`handle_rel_code()` は X/Y/WHEEL/HWHEEL しか扱わないので、戻さないと HID に何も出ない
- **scroll_override** (Scroll レイヤー = 6): `<&tb_pointer>, <&zip_xy_to_scroll_mapper>, <&tb_scroll>`
  - `zip_xy_to_scroll_mapper` が X→HWHEEL, Y→WHEEL に変換 (PMW3610 の `scroll-layers` 相当)
  - `tb_scroll` が向きの反転と粗さ（既定 1/64、分母が大きいほどゆっくり）を担う
  - `process-next` 付き。Android レイヤーが同時にアクティブなときに下の `android_override` へ WHEEL を渡すため
- **mac_gesture_override** (MacGesture レイヤー = 8): `<&tb_pointer>, <&zip_mouse_gesture_mac>, <&zip_xy_scaler 0 1>`
  - `zip_xy_scaler 0 1` はカーソル移動を 0 倍にして止める ([ADR-0005](./docs/adr/0005-macgesture-cursor-leak-workaround.md))
- **android_override** (Android レイヤー = 1、**必ず最後に宣言する**、`process-next` 付き): `<&zip_scroll_transform WHEEL_INV>, <&tb_pointer>, <&zip_xy_to_gesture_axis>`
  - override は宣言順に評価され、最初にマッチしたものが `process-next` なしなら base ごと打ち切る。Android レイヤーは常時アクティブなので、最後に置かないと Scroll / MacGesture を飲み込む
  - 先頭の `zip_scroll_transform` は Scroll レイヤー経由で来た WHEEL を反転する。通常の X/Y イベントには無反応
  - 末尾で X/Y を RX/RY に改名し、`process-next` で base chain に渡す。これで base の `zip_xy_transform` が二重適用されず、macOS 用ジェスチャノードも Android のイベントを見ない

#### ジェスチャ中のカーソル停止

`zmk,input-listener` の layer override は、チェーンが返した `ZMK_INPUT_PROC_STOP` を `process-next` の有無に関わらず握り潰す（`input_listener.c:228-233` が `ret` ではなく `0` を返す）。**`suppress-movement` は base chain に置いたノードでしか効かない。**

- 専用レイヤー（MacGesture のように、そこにいる間ずっとカーソルが死んでよい場合）は `zip_xy_scaler 0 1` で値を潰す（[ADR-0005](./docs/adr/0005-macgesture-cursor-leak-workaround.md)）
- 常時アクティブなレイヤー（Android）は RX/RY 改名で base chain に処理を移す（[ADR-0010](./docs/adr/0010-ble-profile-driven-os-overlay-layer.md)）

チェーンを編集するときは次の 3 点セットを必ず揃えること。1 つでも欠けるとカーソルが動くか、逆に一切動かなくなる。

1. `android_override` に `process-next` と末尾の `zip_xy_to_gesture_axis`
2. base chain に `zip_mouse_gesture_android` と、その後ろの `zip_gesture_axis_to_xy`
3. `zip_mouse_gesture_android` の `event-code-x` / `event-code-y` が `INPUT_REL_RX` / `INPUT_REL_RY`

エンコーダの反転と粗さ調整は `trackball_listener` ではなく `&msc_input_listener` (`config/dax6.keymap`) 側の `android_encoder_override` が担当する。`rsr_scroll` 系の behavior は `&msc` に委譲し、`&msc` は自前の input-listener を持つため。`&kp` を割り当てた音量・輝度には影響しない。

#### エンコーダが 1 デテントで実際に送る値

`ZMK_POINTING_DEFAULT_SCRL_VAL` は 1 イベントの大きさではなく **速度** で、`&msc` は `speed × trigger_period_ms ÷ 1000` を 1 ティック分の値として出す（`behavior_input_two_axis.c:131-152`、`trigger-period-ms` の既定は 16）。

`120 × 16 ÷ 1000 = 1.92` に対し `rsr_scroll` 系の `tap-ms = 20` ではティックが 1 回しか回らず、しかもリリース時に端数が捨てられる（`:139-142` の `speed == 0` で `remainder = 0`）。結果 **1 トリガあたり `REL_WHEEL = 1`、`triggers-per-rotation = 40` なので 1 デテントあたり約 1.67**。

Android 側はホストが 1 notch を固定量（`ViewConfiguration` の scroll factor、典型 64dp）で一括スクロールし加速もしないため、1.67 notch/デテントは「64dp と 128dp が交互」に見える。macOS は OS 側のスムージングでこれが隠れる。

そこで `android_encoder_override` に `<&zip_scroll_scaler 3 5>` を入れて平均 1.0 notch/デテントに落としている。ただし `zip_scroll_scaler` で 1 未満に割ると一部のトリガが値 0 になり「回しても動かないデテント」が生まれる（5 トリガ中 2 回）。トリガ列とデテント列は 1:1.67 で位相が合わないので、どう選んでもデテントごとに完全一定にはならない。

| 分数 | notch/デテント | 値 0 になるトリガ |
|---|---|---|
| なし | 1.67 | 0 |
| `3 5` | 1.00 | 5 回中 2 回 |
| `1 2` | 0.83 | 2 回中 1 回 |

`CONFIG_ZMK_POINTING_SMOOTH_SCROLLING` は使えない。`input_listener.c:267-270` が `scaled` を計算しておきながら `evt->value = val;` と未除算の値を代入しており、分周パスが dead code になっている。

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
rsr_scroll: rsr_scroll {
  compatible = "zmk,behavior-runtime-sensor-rotate";
  tap-ms = <20>;  // ✅ OK: 16ms以上
  // tap-ms = <10>;  // ❌ NG: スクロールが一切動かなくなる
  // tap-ms を書かない  // ❌ NG: binding の既定値は 5
};
```

rsr の behavior は `&kp` を割り当てたもの（`rsr_vol` / `rsr_bri`）も含め、すべて `tap-ms = <20>` にする。DYA Studio は割当を変えるとき、そのレイヤーの現在の `tap_ms` を引き継いで送るので、既定 5 のままのレイヤーに後から `&msc` を割り当てると無反応になる。DYA Studio 側で `&msc` の tap を 16 未満に下げた場合も同じ。

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

**できない。** ZMK 本体に OS 自動検出機能は存在しない（main 系でも同じ）。USB HID descriptor 分析（QMK の `os_detection`）も
BLE GATT 経由の OS 識別も未実装。BLE profile ベースのマッピングが唯一の手段。

dax6 はこの方法を使っている。BLE profile の切り替えに連動して overlay レイヤーを有効にするカスタムモジュール
`app/src/os_layer.c`（`CONFIG_ZMK_OS_LAYER`）で、詳細は「Android オーバーレイレイヤー」節を参照。

### ZMK 本体は cormoran fork（main 系）

`config/west.yml` の `zmk` は upstream ではなく `cormoran/zmk` の `main+custom-studio-protocol` を SHA で固定している。ZMK main（Zephyr 4.1）に custom Studio RPC を足したもので、pointing・behaviors・endpoints・activity・keymap・combo には手が入っていない。判断根拠は [ADR-0012](./docs/adr/0012-migrate-to-zmk-main.md)。

```yaml
- name: zmk
  remote: cormoran
  revision: 1fc72aaff7a42bd533c1f4c9b3f23c5317c745f4  # main+custom-studio-protocol as of 2026-07-22
```

- ボード名は `xiao_ble//zmk`（v0.3 系の `seeeduino_xiao_ble` から変わった）
- fork は upstream main から遅れる。2026-10-11 時点で 59 コミット差があり、split の入力レポートのデッドロック修正（upstream #3110）などが未取り込み
- `main+dya` は hold-tap・tap-dance・`behavior_input_two_axis.c`・activity・keymap まで変更している。既存の挙動への影響が読めないので使わない
- モジュールを足すときは、そのモジュールの CI がどのブランチを対象にしているかを `west/west-dependency/west-test-dependency.yml` で確かめる。`zmk-behavior-runtime-sensor-rotate` の CI は v0.3 系だけが対象で、main 系で動くことは手元のビルドでしか確かめていない

### Nix のビルド環境で詰まりやすい点

- **SDK は 0.17.0 に固定している。** Zephyr 4.1 が想定する版で（`zephyr/SDK_VERSION`）、zephyr-nix の `sdk-0_17`（0.17.4）は同梱の picolibc のロック型が変わっており `locks.c` がコンパイルできない
- **`nixpkgs` は更新しない。** 新しい nixpkgs は `python310` を持たず、zephyr-nix の評価が darwin で失敗する。`nix flake update` は `zephyr` と `zephyr-nix` だけを対象にする
- **nanopb の生成には protobuf と grpcio-tools が要る。** Zephyr 4.1 の requirements に含まれないので `pythonEnv` に足している。west のラッパーが PATH の先頭に素の `python3` を置くため、`PYTHONPATH` でも見えるようにしている

### zmk-rgbled-widget / zmk-driver-paw3222 / zmk-mouse-gesture

いずれも main 系で動く版を SHA で固定している。`revision: main` や tag の直当ては、将来の更新で壊れるので使わない。

- `zmk-rgbled-widget`: `xiao_ble_zmk.overlay` を持つ版。v0.3 系へ戻すなら `a3510c9d`（`seeeduino_xiao_ble` に対応する最後の版）
- `zmk-mouse-gesture`: 以前は tag `v1` を指していたが、この tag は動く。2026-08-16 以降、`suppress-movement` は STOP を返す代わりにイベントの値を 0 にするようになった

PAW3222 ドライバは raw `INPUT_REL_X` / `INPUT_REL_Y` のみ発行する設計のため、orientation /
invert / scroll-layers は **driver Kconfig ではなく ZMK input-processor** で実装する。
詳細は上の「PAW3222 トラックボール」節を参照。

### スクロールが一切反応しない

**チェック項目:**
1. `tap-ms`が16ms以上か？
   - → 20msに設定
   - keymap が 20 でも、DYA Studio で保存した割当の tap が 16 未満だとそちらが優先される
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

## 実行時設定（daxial / DYA Studio）

`dax6_R` に設定アプリから接続すると、再ビルドなしで設定を変えられる。アプリは自作の [daxial](https://github.com/wadackel/daxial)（private）を使う。[DYA Studio](https://studio.dya.cormoran.works/) も同じファームにつながる。判断根拠は [ADR-0011](./docs/adr/0011-dya-studio-support.md) と [ADR-0012](./docs/adr/0012-migrate-to-zmk-main.md)。

| 機能 | 仕組み（custom subsystem の識別子） |
|---|---|
| キー割当・レイヤー名 | 公式 ZMK Studio の RPC |
| エンコーダーの回転割当（レイヤー別・方向別） | `zmk-behavior-runtime-sensor-rotate`（`cormoran_rsr`） |
| トラックボールの向き・倍率、Scroll レイヤーの向き・粗さ | `zmk-module-runtime-input-processor`（`cormoran_rip`） |
| combo | `zmk-feature-runtime-combo`（`cormoran__runtime_combo`） |
| マクロ | `zmk-feature-runtime-macro`（`cormoran__runtime_macro`） |
| PAW3222 の CPI | `app/src/trackball_settings.c`（`dax_trackball`、値は custom-settings 経由） |

実行時に変えられないもの: エンコーダーの `triggers-per-rotation`、マウスジェスチャーの調整値とパターン、hold-tap のタイミング。

共通の約束事:

- **keymap / overlay に書いた値は既定値で、アプリで保存した値が優先される。** 既定値を書き換えてフラッシュしても、保存済みの項目には反映されない。既定値に戻すにはアプリの reset か `settings_reset.uf2`（BLE のボンドも消える）
- 設定の置き場は `zmk-feature-custom-settings`（`cormoran_custom_settings`）。`zmk-behavior-runtime-sensor-rotate` だけは Zephyr の settings に直接書く

### トラックボールの実行時調整

`dax6_R.overlay` の `tb_pointer` と `tb_scroll` が、固定だった `zip_xy_transform` と `zip_scroll_transform` + `zip_scroll_scaler` を置き換えている。

- `tb_pointer` は反転を「入替の前の軸」で判定する。`xy-swap-enabled; x-invert;` が、以前の `zip_xy_transform (XY_SWAP | Y_INVERT)` と同じ結果になる
- `tb_pointer` は Scroll レイヤーのチェーンでも先頭にいるので、その倍率はスクロールにも掛かる
- `tb_pointer` が扱うのは X/Y だけ。Android の RX/RY には触らないので、base chain で二重に掛かることはない
- エンコーダーのスクロール（`&msc_input_listener` 側の反転と 3/5 倍率）は固定のまま

### combo とマクロ

- combo は `config/dax6.keymap` の `runtime_combo_defaults`（`cormoran,runtime-combo-defaults`）に書く。`zmk,combos` のノードは無い。レイヤーの絞り込みが「最上位のアクティブレイヤー 1 つ」しか見ない点は変わらないので、`layers = <0 1>` と書く
- マクロは実行時マクロ（`&rmacro <slot>`）で、`zmk,behavior-macro` のノードは無い。`esc_lang2` は `cormoran,runtime-macro-default` の既定値で、`esc_lang2_with_layer` の tap 側が `&rmacro` を呼ぶ。keymap の `&esc_lang2_with_layer 4 0` の `0` がスロット番号
- **既定値のスロット番号はビルド時に決まらない。** 最初に作られたときの空きスロットに入る。既定値が `esc_lang2` だけなら settings reset の直後はスロット 0 に入る想定。既定値のマクロを足したり、settings reset をしたりしたあとは、アプリのマクロ一覧で `esc_lang2` の番号を確かめる。ずれていると ESC / LANG2 のキーが効かない

### エンコーダー割当の仕組み

全レイヤーの `sensor-bindings` は `zmk,behavior-runtime-sensor-rotate` の behavior（`rsr_scroll` / `rsr_scroll_rev` / `rsr_hscroll` / `rsr_vol` / `rsr_bri`）を指す。各 behavior の `cw-binding` / `ccw-binding` がコンパイル時の既定値で、アプリで保存した割当があればそちらが優先される。

- **書き込みは即時に flash へ保存される。** 試してからキャンセルする操作はない
- **保存済みの割当は keymap より強い。** keymap の `cw-binding` を書き換えてフラッシュしても、DYA Studio で一度保存したレイヤーには反映されない。既定値に戻すには `settings_reset.uf2` を書き込む（BLE のボンドも消える）
- **`sensor-bindings` を rsr 以外の behavior にしたレイヤーは DYA Studio から編集できない。** runtime 設定は、そのレイヤーの sensor-binding が rsr に解決されるときだけ参照される
- 回転方向ごとの既定値を keymap で変えるときは、レイヤーの `sensor-bindings` ではなく behavior ノードを編集する。ノードは複数のレイヤーで共有されている
- `triggers-per-rotation` はコンパイル時のまま。`&msc_input_listener` の Android 反転と 3/5 倍率は `&msc` の下流なので、DYA Studio で割当を変えても効き続ける

### 接続

- USB（`studio-rpc-usb-uart` snippet）で Chromium 系ブラウザから接続する。`CONFIG_ZMK_STUDIO_LOCKING=n` なので unlock 操作は不要
- BLE 経由は未検証。fork の `ZMK_STUDIO_LOCK_BLE_DIRECT_ADVERTISING_ON_UNLOCK` は LOCKING=n だと無効で、ホストと接続済みの間は広告が出ないため、Android Chrome（BLE のみ対応）からは見つからない可能性がある
- 機体を複数つなぎ替える場合、DYA Studio の変更履歴は機体名で分かれる。`CONFIG_ZMK_KEYBOARD_NAME` を機体ごとに変えておく

## 現在のレイヤー構成

| 番号 | 名前 | 説明 |
|------|------|------|
| 0 | default_layer | デフォルト |
| 1 | Android | BLE プロファイル 3 選択中に常時アクティブな OS オーバーレイ |
| 2 | Symbol | 記号 |
| 3 | Num | 数字 |
| 4 | Function | ファンクション・矢印 |
| 5 | Mouse | マウスボタン |
| 6 | Scroll | スクロールモード |
| 7 | Device | BLE設定 |
| 8 | MacGesture | macOS用マウスジェスチャ (Mouse layerから遷移) |

### Android オーバーレイレイヤー (= 1)

`CONFIG_ZMK_OS_LAYER=y` + `CONFIG_ZMK_OS_LAYER_PROFILE_3=1` (`dax6_R.conf`) により、BLE プロファイル 3 を選ぶと `app/src/os_layer.c` がこのレイヤーを常時アクティブにする。詳細と判断根拠は [ADR-0010](./docs/adr/0010-ble-profile-driven-os-overlay-layer.md)。

レイヤーを追加・並べ替えるときに壊れやすい点:

- **`&to` は使わない。** v0.3 系では `&to` が全レイヤーを deactivate し、常時アクティブなオーバーレイも落ちて次のプロファイル変更まで復帰しなかった。main 系では `os_layer.c` がレイヤーをロックして有効にするので、ロックなしの `&to` では落ちないはずだが、実機では未確認。確かめるまで、レイヤーの出入りは `&tog` / `&mo` で行う
- **combo の `layers` は `<0 1>` と書く。** combo のレイヤーフィルタは「最上位のアクティブレイヤー 1 つ」しか見ない。非 Android 時は `highest=0`、Android 時は `highest=1` になるため両方を列挙する必要がある
- **Android レイヤーは index 1 に置く。** 最上位に置くと `highest_active_layer` が常に Android になり、combo のレイヤー限定が全レイヤーで無効化される
- 上書きするキー位置は他レイヤーで `&trans` のものを選ぶ。Android(1) は Symbol(2) 以上に負けるが、default_layer(0) は上書きできる

## CI / デプロイ

### ファームウェアビルド
- `.github/workflows/build.yml` - push/PR/手動トリガーで実行
- ZMK の reusable workflow（`zmkfirmware/zmk/.github/workflows/build-user-config.yml` を upstream main の SHA で固定）を使用。workflow 自体は upstream のものだが、ビルドする ZMK は `config/west.yml` が指す cormoran fork
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
- Sensors タブは `sensor-bindings` が指す rsr の behavior から CW / CCW の既定値を解決して表示する（表示専用。割当の付け替えは BindingDock、`cw-binding` / `ccw-binding` の編集は Behaviors タブ）。`&msc` を使う rsr の behavior ごとに `tap-ms` を検査し、16 未満または未指定をエラーにする。
- editor が編集するのは keymap の既定値で、アプリで保存済みの値は上書きしない。
- **Combos タブは今の keymap の combo を扱えない。** editor は `zmk,combos` のノードを前提にしており、`runtime_combo_defaults` を読まない。テスト用の fixture（`__fixtures__/dax6.keymap`）も移行前の keymap のまま。combo の編集は daxial で行う。
- 保存後のファーム反映は手動: `nix develop --command just build-target dax6_R`。

## 参考ドキュメント

- [ADR (Architecture Decision Records)](./docs/adr/README.md) - 意思決定の記録
- [詳細な学び](./docs/encoder-tuning-learnings.md) - 試行錯誤の過程と深い理解
- [ZMK Documentation](https://zmk.dev/)
- [DYA Studio 開発者ガイド](https://studio.dya.cormoran.works/developer-guide)
