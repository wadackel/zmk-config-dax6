# dax6 ZMK configuration

ZMK firmware for the dax6 split keyboard: 44 keys, two rotary encoders, and a
PAW3222 trackball on the right half, which is the central.

The firmware is built on the ZMK main line (Zephyr 4.1) from the `cormoran/zmk`
fork, so most settings can be changed on the running keyboard with
[daxial](https://github.com/wadackel/daxial) instead of rebuilding: key
bindings, encoder rotation, trackball direction and speed, mouse gestures,
combos and macros. Values in this repository are the defaults; what is saved
from the app wins over them.

`AGENTS.md` is the detailed guide (hardware, input chains, layers, pitfalls),
and `docs/adr/` records why things are the way they are.

## Build

Needs [Nix](https://nixos.org/download.html) with flakes enabled. Commands run
through the development shell, either inside `nix develop` or one at a time:

```bash
nix develop --command just setup                  # once: fetch ZMK, Zephyr and the modules
nix develop --command just build                  # both halves and the settings reset image
nix develop --command just build-target dax6_R    # one target: dax6_R, dax6_L or settings_reset
nix develop --command just clean                  # remove build output
nix develop --command just pristine               # also remove the west workspace
```

| Output | For |
|---|---|
| `build/dax6_R.uf2` | Right half: central, trackball, ZMK Studio |
| `build/dax6_L.uf2` | Left half: peripheral |
| `build/settings_reset.uf2` | Erases stored settings, including BLE bonds and everything saved from the app |

To flash, put a half into its bootloader and copy the matching file onto the
drive that appears. After `settings_reset.uf2`, flash the half's own firmware
again and re-pair it with each host; flash both halves if they no longer find
each other.

Do not run `nix flake update`: the toolchain depends on the pinned `nixpkgs`
and on Zephyr SDK 0.17.0 (see "Nix のビルド環境で詰まりやすい点" in `AGENTS.md`).

## Test

```bash
just test                  # every native_sim test under tests/ (needs Docker)
just test tests/combos     # one test
```

The tests feed mocked key and pointer input to the real keymap and input
chains and compare the HID reports that come out. Tests for the gesture
recognizer itself live in
[zmk-dax-modules](https://github.com/wadackel/zmk-dax-modules).

## Layout

| Path | Contents |
|---|---|
| `config/` | Keymap (`dax6.keymap`), gesture defaults (`gestures.dtsi`), west manifest |
| `boards/shields/dax6/` | Shield definition, per-half overlays and configuration |
| `tests/` | native_sim tests and their runner |
| `docs/adr/` | Architecture decision records |
| `module/` | Empty Zephyr module files that keep this repository from picking up Zephyr's own |

## Modules

Pinned by commit in `config/west.yml`.

| Module | Role |
|---|---|
| `cormoran/zmk` (`main+custom-studio-protocol`) | ZMK with custom Studio RPC |
| `wadackel/zmk-dax-modules` | Mouse gestures, the per-profile OS layer, trackball CPI setting, combos and macros editable at runtime |
| `zmk-driver-paw3222` | Trackball sensor driver |
| `zmk-behavior-runtime-sensor-rotate` | Encoder bindings editable at runtime |
| `zmk-rgbled-widget` | Status LED |

## CI

`.github/workflows/build.yml` builds the targets listed in `build.yaml` with
ZMK's reusable workflow, pinned to a commit.
