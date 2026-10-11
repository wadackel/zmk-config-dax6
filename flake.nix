{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

    # ZMK main が使用するZephyrバージョン
    zephyr.url = "github:zmkfirmware/zephyr/v4.1.0+zmk-fixes";
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
          # Zephyr 4.1 は SDK 0.17.0 を前提にしている（zephyr/SDK_VERSION）。zephyr-nix の sdk-0_17 は 0.17.4 で、
          # 同梱の picolibc のロック型が変わっており locks.c がコンパイルできない。0.17.0 を公式の sha256.sum で固定する
          sdkFiles = {
            version = "0.17.0";
            files = {
              "zephyr-sdk-0.17.0_linux-aarch64_minimal.tar.xz" = "889f10c68a179f5ff2e4ea84749202c117bb522af705d5a888ebe76373acac5a";
              "zephyr-sdk-0.17.0_linux-x86_64_minimal.tar.xz" = "0514d2c684dfb5f6327374bfed0b3dcf727ff1500195d26b3730f98252fed095";
              "zephyr-sdk-0.17.0_macos-aarch64_minimal.tar.xz" = "d6dd38ac08d1e3e8d4653a7f03f6f52a704fc9317d8eed6e950e107829f929c4";
              "zephyr-sdk-0.17.0_macos-x86_64_minimal.tar.xz" = "c3b7705afd3721fcd545f7011eb5662aa099ff5f8efeeba0894700798c4b1f35";
              "toolchain_linux-aarch64_arm-zephyr-eabi.tar.xz" = "b88e22918c0f9e7d33a329f01000d47a2bd00c4dfb80cc83c5308095f0eaeebd";
              "toolchain_linux-x86_64_arm-zephyr-eabi.tar.xz" = "c3992a788a0896ecc87f7fb3a3be3f234ec0509220bd4e9dbd99b22edd55e97f";
              "toolchain_macos-aarch64_arm-zephyr-eabi.tar.xz" = "1168c50a193a7d5b8ee583dad70bd33bbe43903551096f2e4854cd527c415d5c";
              "toolchain_macos-x86_64_arm-zephyr-eabi.tar.xz" = "68f58fe77f94198f440b4c05fbb8503360f45712d5f5380ba39dfaea0736e7cb";
            };
          };
          # packagesとshellHookで同一derivationを参照する
          sdk = (pkgs.callPackage (import "${zephyr-nix}/sdk.nix" sdkFiles) { }).sdk.override {
            targets = ["arm-zephyr-eabi"];
          };
          # nanopb のジェネレータ（Studio と各モジュールの .proto）が protobuf と grpcio-tools を要求する。
          # Zephyr 4.1 の requirements には含まれないので足す
          pythonEnv = zephyr.pythonEnv.override {
            extraPackages = ps: [ps.protobuf ps.grpcio-tools ps.setuptools];
          };
        in {
          default = pkgs.mkShellNoCC {
            packages = [
              # Zephyr専用ツール
              pythonEnv
              sdk

              # ZMKビルド専用ツール
              pkgs.cmake
              pkgs.dtc
              pkgs.ninja
              pkgs.ccache

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

              # west のラッパーは PATH の先頭に素の python3 を足すため、nanopb のスクリプト
              # (`#!/usr/bin/env python3`) は pythonEnv の外で動く。protobuf / grpcio-tools をそこから見えるようにする
              export PYTHONPATH="${pythonEnv}/${pkgs.python3.sitePackages}''${PYTHONPATH:+:$PYTHONPATH}"

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
