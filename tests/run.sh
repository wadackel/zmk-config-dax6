#!/usr/bin/env bash
# Runs ZMK native_sim tests in the ZMK build container against this west workspace, so they see
# the exact ZMK and module revisions the firmware is built from.
#
#   tests/run.sh <test dir> [...]                        # e.g. tests/run.sh tests/combos
#   ZMK_TESTS_AUTO_ACCEPT=1 tests/run.sh tests/combos    # rewrite the snapshot
#   ZMK_TESTS_RESYNC=1 tests/run.sh ...                  # after `west update`
#
# native_sim is a Linux executable, hence the container. The image is used at the host's own
# architecture: under x86 emulation on Apple silicon the compiler crashes at random.
# The workspace is copied into a Docker volume rather than bind-mounted, so this works where the
# container runtime is not allowed to see the host's source directories. Zephyr and its modules
# are copied once; everything else is refreshed on every run.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
image="zmkfirmware/zmk-build-arm:4.1"
volume="dax6-zmk-tests"
heavy=(zephyr modules)
# west resolves `import:` from each project's git history, so ZMK and Zephyr keep their .git.
skip=(--exclude='modules/*/.git' --exclude='modules/*/*/.git' --exclude='modules/*/*/*/.git' --exclude=./.ccache --exclude='fsmonitor--daemon.ipc')

into_volume() { docker run --rm -i -v "$volume:/work" alpine tar -x -C /work; }

if [ -n "${ZMK_TESTS_RESYNC:-}" ] || ! docker run --rm -v "$volume:/work" alpine test -f /work/.heavy-synced; then
  echo "Copying Zephyr and its modules into the $volume volume (once)..." >&2
  docker run --rm -v "$volume:/work" alpine sh -c 'rm -rf /work/zephyr /work/modules /work/.heavy-synced'
  COPYFILE_DISABLE=1 tar -c -C "$root" "${skip[@]}" "${heavy[@]}" | into_volume
  docker run --rm -v "$volume:/work" alpine touch /work/.heavy-synced
fi

light=()
for entry in "$root"/* "$root"/.west; do
  name="$(basename "$entry")"
  case " ${heavy[*]} build rollback-v0.3 " in *" $name "*) continue ;; esac
  light+=("$name")
done
docker run --rm -v "$volume:/work" alpine sh -c 'cd /work && for e in * .west; do case "$e" in zephyr|modules|build) ;; *) rm -rf "$e" ;; esac; done'
COPYFILE_DISABLE=1 tar -c -C "$root" "${skip[@]}" "${light[@]}" | into_volume

tests=()
for testpath in "$@"; do tests+=("$(cd "$testpath" && pwd | sed "s|^$root/||")"); done

docker run --rm -v "$volume:/work" -w /work \
  -e ZMK_TESTS_AUTO_ACCEPT="${ZMK_TESTS_AUTO_ACCEPT:-}" \
  "$image" bash -c '
    set -uo pipefail
    git config --global --add safe.directory "*"
    west zephyr-export >/dev/null
    status=0
    for testpath in "$@"; do
      name="$(echo "$testpath" | tr / _)"
      build="build/tests/$name"
      if ! west build -s zmk/app -d "$build" -b native_sim//zmk_test_mock -p -- \
          -DCONFIG_ASSERT=y -DZMK_CONFIG="/work/$testpath" >"/tmp/$name.build.log" 2>&1; then
        echo "FAILED: $testpath did not build"; grep -E "warning: |error|Error" -A6 "/tmp/$name.build.log" | head -60; status=1; continue
      fi
      "$build/zephyr/zmk.exe" | sed -e "s/.*> //" | tee "$build/keycode_events_full.log" \
        | sed -n -f "$testpath/events.patterns" >"$build/keycode_events.log"
      if [ -n "${ZMK_TESTS_AUTO_ACCEPT:-}" ]; then
        echo "ACCEPTED: $testpath"; echo "--- snapshot"; cat "$build/keycode_events.log"; echo "--- end"
      elif diff -auZ "$testpath/keycode_events.snapshot" "$build/keycode_events.log"; then
        echo "PASS: $testpath"
      else
        echo "FAILED: $testpath"; status=1
      fi
    done
    exit $status
  ' _ "${tests[@]}" || status=$?

if [ -n "${ZMK_TESTS_AUTO_ACCEPT:-}" ]; then
  for testpath in "${tests[@]}"; do
    log="/work/build/tests/$(echo "$testpath" | tr / _)/keycode_events.log"
    if docker run --rm -v "$volume:/work" alpine test -f "$log"; then
      docker run --rm -v "$volume:/work" alpine cat "$log" >"$root/$testpath/keycode_events.snapshot"
    fi
  done
fi
exit "${status:-0}"
