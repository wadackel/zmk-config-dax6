# keymap-dt

A small DeviceTree parser/serializer tailored to ZMK `.keymap` files.

## Goals

- Edit specific known section kinds (layers, combos, macros, behaviours, mouse-gesture blocks, root `&mt`/`&lt`).
- Preserve everything else byte-for-byte: comments, `#define`s, `#include`s, unknown DT blocks.
- Round-trip structurally: `parse → serialize → parse` yields deep-equal structured data.

We intentionally do NOT aim for a fully general DT parser. Trying to round-trip arbitrary `.dts` documents would require modelling comment retention and preprocessor expansion, both of which are out of scope.

## Modules

| File | Purpose |
|---|---|
| `lexer.ts` | Tokenize the source. Whitespace and comments are emitted as tokens so callers can reassemble the original text byte-for-byte. |
| `sections.ts` | Walk the token stream, track brace depth, report `{ kind, name, range, headerRange, bodyRange }` for every recognized section. |
| `parse.ts` | Section-aware parsing: returns structured `LayerData[]`, `ComboEntry[]`, `MacroEntry[]`, `BehaviorEntry[]`, `MouseGestureBlock[]`, `RootBehaviorConfig[]`. |
| `serialize.ts` | Section-level emit: produces a clean DT text fragment for a single section body (whole-section re-emit, not minimal patch). |
| `patch.ts` | Range-based text patcher: takes `Edit[] = { range, replacement }` and produces a new text. Overlapping ranges throw. |
| `lint.ts` | Pre-save validator: brace balance, layer key count (=44), behaviour arity, combo `key-positions` range, reference integrity. |
| `atomic-write.ts` | tmp → rename. One backup per server-process lifetime. mtime-based concurrency token. |
| `repo-path.ts` | Resolves `config/dax6.keymap` from `DAX6_REPO_ROOT` or `cwd/../..`. |
| `types.ts` | Shared types. |
| `__fixtures__/dax6.keymap` | Live `config/dax6.keymap` copy used by every roundtrip / lint test. |

## Editing policy

- **Whole-section re-emit**: when a layer/combo/macro/behaviour changes, the entire section body is re-formatted on save. A single binding change still rewrites the layer's bindings block. The first save normalises whitespace inside edited sections; subsequent edits are stable.
- **Comment scope**: comments inside an edited section's body are dropped on serialise. Comments outside section bodies survive.
- **Bindings layout**: per-column max width across all 4 rows of the 44-key grid, joined with 3-space separators, with a 19-space L-R gap (the exact constants are fixture-derived).

## Adding a new section kind

1. Add a `SectionKind` value in `types.ts`.
2. Recognise the section in `sections.ts` (most are caught by `consumeNamedBlock` / `consumeBlockAfterRef`).
3. Implement structured parsing in `parse.ts`.
4. Implement serialisation in `serialize.ts`.
5. Add a fixture-driven test in `parse.others.test.ts` and a serialise round-trip test.
