import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseKeymap } from './parse'
import {
  chainToString,
  serializeBehavior,
  serializeBindingsGrid,
  serializeCombo,
  serializeLayer,
  serializeMacro,
  serializeMouseGestureBlock,
} from './serialize'

const fixturePath = path.resolve(__dirname, '__fixtures__/dax6.keymap')
const fixture = readFileSync(fixturePath, 'utf8')

describe('serialize', () => {
  const parsed = parseKeymap(fixture)

  it('chainToString joins tokens with a single space', () => {
    expect(chainToString({ tokens: ['&kp', 'A'] })).toBe('&kp A')
    expect(chainToString({ tokens: ['&mt', 'LEFT_GUI', 'LANG2'] })).toBe('&mt LEFT_GUI LANG2')
  })

  it('serializeBindingsGrid produces 4 lines with the correct visible cells', () => {
    const dl = parsed.layers[0]
    const grid = serializeBindingsGrid(dl.bindings)
    const lines = grid.split('\n')
    expect(lines.length).toBe(4)
    // Row 0 must start with `&kp TAB`.
    expect(lines[0].startsWith('&kp TAB')).toBe(true)
    // Row 0 must contain every R-side keycode.
    for (const k of ['Y', 'U', 'I', 'O', 'P']) {
      expect(lines[0]).toContain(`&kp ${k}`)
    }
    // dax6 R3 has 4 L cells (c3..c6) + 2 R cells (c7,c8) = 6 cells. R3
    // bindings are mostly &mt/&lt/&esc_lang2_with_layer (only 1 is &kp),
    // so count binding chains by their leading `&` rather than &kp.
    const r3CellCount = (lines[3].match(/&/g) ?? []).length
    expect(r3CellCount).toBe(6)
  })

  // Golden test: pins the exact canonical bytes serializeBindingsGrid emits for
  // the real default_layer. The structural round-trip below proves no data loss
  // but is whitespace-insensitive, so it cannot bound the first-save diff. This
  // golden does: any change to the R3 sparse-column geometry (c11), LR_GAP, or
  // per-column widths that would balloon the first-save diff fails here. The
  // canonical form must also be a stable fixed point (idempotent re-serialize).
  it('serializes default_layer to the canonical golden bytes and is idempotent', () => {
    const golden = readFileSync(
      path.resolve(__dirname, '__fixtures__/default_layer.grid.golden'),
      'utf8',
    ).replace(/\n$/, '')
    const dl = parsed.layers[0]
    const grid = serializeBindingsGrid(dl.bindings)
    expect(grid).toBe(golden)

    // Re-parse the canonical grid and re-serialize; the format is a fixed point.
    const wrapped = `/ { keymap { compatible = "zmk,keymap"; default_layer { bindings = <\n${grid}\n>; }; }; };`
    const grid2 = serializeBindingsGrid(parseKeymap(wrapped).layers[0].bindings)
    expect(grid2).toBe(grid)
  })

  it('round-trips a layer (parse → serialize → parse) preserving structured data', () => {
    const dl = parsed.layers[0]
    // Build a synthetic layer body and re-parse via parseKeymap by wrapping in
    // a minimal keymap container.
    const body = serializeLayer(dl)
    const reconstructed = `
/ {
  keymap {
    compatible = "zmk,keymap";
    default_layer {${body}};
  };
};
`
    const reparsed = parseKeymap(reconstructed)
    expect(reparsed.layers.length).toBe(1)
    expect(reparsed.layers[0].bindings.length).toBe(44)
    expect(reparsed.layers[0].bindings).toEqual(dl.bindings)
    if (dl.sensorBindings) {
      expect(reparsed.layers[0].sensorBindings).toEqual(dl.sensorBindings)
    }
  })

  it('round-trips a combo entry', () => {
    const combo = parsed.combos[0]
    const body = serializeCombo(combo)
    const wrapped = `/{ combos { compatible="zmk,combos"; ${combo.name} {${body}}; }; };`
    const reparsed = parseKeymap(wrapped)
    expect(reparsed.combos[0]).toEqual(combo)
  })

  it('round-trips a macro entry', () => {
    const macro = parsed.macros[0]
    const body = serializeMacro(macro)
    const wrapped = `/{ macros { ${macro.name} {${body}}; }; };`
    const reparsed = parseKeymap(wrapped)
    expect(reparsed.macros[0].name).toBe(macro.name)
    expect(reparsed.macros[0].bindingsList).toEqual(macro.bindingsList)
  })

  it('round-trips a behavior entry', () => {
    const behavior = parsed.behaviors[0]
    const body = serializeBehavior(behavior)
    const wrapped = `/{ behaviors { ${behavior.name} {${body}}; }; };`
    const reparsed = parseKeymap(wrapped)
    expect(reparsed.behaviors[0].name).toBe(behavior.name)
    expect(reparsed.behaviors[0].compatible).toBe(behavior.compatible)
    expect(reparsed.behaviors[0].bindings).toEqual(behavior.bindings)
  })

  it('round-trips a mouse-gesture root block', () => {
    const root = parsed.mouseGestures.find((b) => b.kind === 'root')!
    const body = serializeMouseGestureBlock(root)
    const wrapped = `&zip_mouse_gesture {${body}};`
    const reparsed = parseKeymap(wrapped)
    const rootRe = reparsed.mouseGestures.find((b) => b.kind === 'root')!
    expect(rootRe.entries.map((e) => e.name)).toEqual(root.entries.map((e) => e.name))
    expect(rootRe.entries.map((e) => e.pattern)).toEqual(root.entries.map((e) => e.pattern))
    expect(rootRe.entries.map((e) => e.bindings.tokens)).toEqual(
      root.entries.map((e) => e.bindings.tokens),
    )
  })
})
