{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

    # ZMK v0.3が使用するZephyrバージョン
    zephyr.url = "github:zmkfirmware/zephyr/v3.5.0+zmk-fixes";
    zephyr.flake = false;

    # zephyr-nixでSDKとPython環境を提供
    zephyr-nix.url = "github:urob/zephyr-nix";
    zephyr-nix.inputs.zephyr.follows = "zephyr";
    zephyr-nix.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { nixpkgs, zephyr-nix, ... }:
    let
      systems = ["x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin"];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in {
      devShells = forAllSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          zephyr = zephyr-nix.packages.${system};
          # arm-zephyr-eabi ツールチェーン入りSDK。packagesとshellHookで同一derivationを参照する
          sdk = zephyr.sdk-0_16.override { targets = ["arm-zephyr-eabi"]; };
        in {
          default = pkgs.mkShellNoCC {
            packages = [
              # Zephyr専用ツール
              zephyr.pythonEnv
              sdk

              # ZMKビルド専用ツール
              pkgs.cmake
              pkgs.dtc
              pkgs.ninja
              pkgs.ccache

              # nanopb protoc用にsetuptoolsを追加（pkg_resources対応）
              pkgs.python3Packages.setuptools

              # ワークフロー必須ツール（環境の自己完結性のため）
              pkgs.git
              pkgs.just
            ];

            shellHook = ''
              # プロジェクトルート検出（gitリポジトリルート）
              PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")"

              # Zephyr環境変数
              export ZEPHYR_BASE="$PROJECT_ROOT/zephyr"
              export ZEPHYR_TOOLCHAIN_VARIANT=zephyr

              # SDK_INSTALL_DIR明示設定（packagesと同一のSDK derivationを参照）
              export ZEPHYR_SDK_INSTALL_DIR="${sdk}"

              # ccache設定
              export CCACHE_DIR="$PROJECT_ROOT/.ccache"
              export CCACHE_BASEDIR="$PROJECT_ROOT"  # パス差分によるキャッシュミス低減
              export CCACHE_MAXSIZE=2G
            '';
          };
        }
      );
    };
}
