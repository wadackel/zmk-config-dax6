# DAX6 ZMK Configuration

ZMK firmware configuration for DAX6 keyboard with local Nix-based build environment.

## Features

- **Nix-based development environment** - Reproducible builds with flake.nix
- **Fast local builds** - ~1 minute initial build, 15-30 seconds with ccache
- **No Docker dependency** - Native Nix toolchain
- **Just-based workflow** - Simple commands for common tasks

## Prerequisites

### Required

- [Nix](https://nixos.org/download.html) with flakes enabled

### Flakes Setup

If you haven't enabled flakes yet, add to `~/.config/nix/nix.conf`:

```
experimental-features = nix-command flakes
```

## Quick Start

### 1. Clone and Enter Directory

```bash
git clone <your-repo-url>
cd zmk-config-dax6
```

### 2. Enter Nix Development Shell

```bash
nix develop
```

### 3. Initialize Workspace

```bash
just setup
```

### 4. Build Firmware

```bash
just build
```

Build artifacts will be in `build/`:
- `build/dax6_R.uf2` - Right hand (with trackball + ZMK Studio)
- `build/dax6_L.uf2` - Left hand
- `build/settings_reset.uf2` - Settings reset utility

## Common Commands

All commands should be run inside the Nix development environment (`nix develop`).

### Build Commands

```bash
# Build all targets
just build

# Build specific target
just build-target dax6_R
just build-target dax6_L
```

### Maintenance

```bash
# Clean build artifacts
just clean

# Setup workspace (after git pull or clean)
just setup

# Check ccache statistics
ccache -s
```

### Non-Interactive Execution

You can run any command without entering an interactive shell:

```bash
nix develop --command just build
nix develop --command just build-target dax6_R
```

This is useful for CI scripts or automated tools.

## Apple Silicon Notes

The build environment is configured for native Apple Silicon (aarch64-darwin) builds. If you encounter SDK-related errors, you can run using Rosetta translation:

### Using Rosetta (if needed)

Use the `--system` flag to force x86_64 emulation:

```bash
nix develop --system x86_64-darwin
```

Then run your build commands as normal:

```bash
just setup
just build
```

## Project Structure

```
.
├── flake.nix              # Nix development environment definition
├── flake.lock             # Locked dependency versions
├── config/                # ZMK configuration files
│   ├── west.yml          # West manifest
│   └── dax6.keymap       # Keymap definition
├── boards/                # Board definitions
│   └── shields/dax6/     # DAX6 shield configuration
└── build/                 # Build output (git-ignored)
```

## Build Performance

| Build Type | Time | Notes |
|------------|------|-------|
| Initial build | ~1 minute | First build after setup |
| Incremental build | 15-30 seconds | With ccache enabled |
| Clean build | ~1 minute | After `just clean` |

## Troubleshooting

### "Must run inside nix develop environment"

Enter the Nix development shell:

```bash
nix develop
```

### Build fails with SDK errors on Apple Silicon

Switch to x86_64 mode (Rosetta):

```bash
nix develop --system x86_64-darwin
```

Then run setup and build:

```bash
just setup
just build
```

### "pkg_resources" module not found

This should be resolved in flake.nix. If the error persists, ensure you're using the latest flake.lock:

```bash
nix flake update
```

### west workspace issues

Re-initialize the workspace:

```bash
rm -rf .west modules zmk zephyr bootloader
just setup
```

## Custom Modules

This configuration uses the following custom ZMK modules:

- **zmk-pmw3610-driver** - Trackball sensor driver (PMW3610)
- **zmk-rgbled-widget** - RGB LED widget support

These are automatically fetched during `just setup` via west.yml.

## GitHub Actions

GitHub Actions continue to use the official ZMK Docker-based workflow for consistency and compatibility. Local builds use Nix for speed.

## License

[Your License Here]
