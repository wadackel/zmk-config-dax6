# List available recipes
default:
    @just --list

# Guard: ensure we are inside the nix develop environment
_require-nix:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -z "${ZEPHYR_SDK_INSTALL_DIR:-}" ]; then
      echo "ERROR: Must run inside nix develop environment"
      echo "Run: nix develop"
      exit 1
    fi

# Initial setup: Initialize west workspace and fetch modules
setup: _require-nix
    #!/usr/bin/env bash
    set -euo pipefail
    if [ ! -f .west/config ]; then
      echo "Initializing west workspace..."
      west init -l config/
    fi
    echo "Fetching external modules..."
    west update
    echo "Installing Python packages..."
    west zephyr-export
    echo "Setup complete!"

# Build all targets
build: (build-target "dax6_R") (build-target "dax6_L") (build-target "settings_reset")

# Build a specific target (e.g., just build-target dax6_R)
build-target TARGET="dax6_R": _require-nix
    #!/usr/bin/env bash
    set -euo pipefail
    PROJECT_ROOT="$PWD"

    if [ ! -f .west/config ]; then
      echo "ERROR: West workspace not initialized"
      echo "Run: just setup"
      exit 1
    fi

    case "{{TARGET}}" in
      dax6_R)
        SHIELD="dax6_R;rgbled_adapter"
        SNIPPET="studio-rpc-usb-uart"
        ;;
      dax6_L)
        SHIELD="dax6_L;rgbled_adapter"
        SNIPPET=""
        ;;
      settings_reset)
        SHIELD="settings_reset"
        SNIPPET=""
        ;;
      *)
        echo "Error: Unknown target '{{TARGET}}'"
        echo "Usage: just build-target [dax6_R|dax6_L|settings_reset]"
        exit 1
        ;;
    esac

    echo "Building: {{TARGET}}"

    west build -s zmk/app -b xiao_ble//zmk -d "build/{{TARGET}}" -- \
      -DBOARD_ROOT="$PROJECT_ROOT" \
      -DSHIELD="$SHIELD" \
      ${SNIPPET:+-DSNIPPET="$SNIPPET"} \
      -DZMK_CONFIG="$PROJECT_ROOT/config" \
      -DZMK_EXTRA_MODULES="$PROJECT_ROOT" \
      -DCMAKE_C_COMPILER_LAUNCHER=ccache \
      -DCMAKE_CXX_COMPILER_LAUNCHER=ccache

    if [ -f "build/{{TARGET}}/zephyr/zmk.uf2" ]; then
      cp "build/{{TARGET}}/zephyr/zmk.uf2" "build/{{TARGET}}.uf2"
      echo "Build complete: build/{{TARGET}}.uf2"
    else
      echo "Build failed: UF2 file not found"
      exit 1
    fi

# Clean build artifacts
clean:
    @echo "Cleaning build artifacts..."
    @rm -rf build/
    @echo "Build artifacts cleaned"

# Complete cleanup including west workspace (for recovery from broken states)
pristine:
    @echo "Performing complete cleanup..."
    @rm -rf build/ .west/ modules/ zephyr/ zmk/ bootloader/ .ccache/
    @echo "Complete cleanup done. Run 'just setup' to reinitialize."
