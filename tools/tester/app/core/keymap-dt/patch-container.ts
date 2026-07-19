// Rewrite whole-container bodies (keymap / combos / macros / behaviors) plus
// mouse-gesture / root-behaviour section bodies from a draft. Same-source
// containers are rewritten in one pass so add / remove / rename take a single
// path — the alternative (targeting individual entries with fine-grained
// edits) would multiply the code paths and still need to consult neighbouring
// entries to preserve inter-entry whitespace.

import type { EditorDraft } from '../editor-state/types'
import { parseKeymap, type ParsedKeymap } from './parse'
import { applyEdits, type Edit } from './patch'
import {
  detectLineIndent,
  serializeBehavior,
  serializeCombo,
  serializeLayer,
  serializeMacro,
  serializeMouseGestureBlock,
  serializeRootBehavior,
} from './serialize'

const INDENT = '        ' // 8 spaces — container-body indentation for both props and entries

export function buildCandidateText(baseSource: string, draft: EditorDraft): string {
  const parsed = parseKeymap(baseSource)
  const edits: Edit[] = []

  patchKeymapContainer(parsed, edits, draft.layers)
  patchCombosContainer(parsed, edits, draft.combos)
  patchMacrosContainer(parsed, edits, draft.macros)
  patchBehaviorsContainer(parsed, edits, draft.behaviors)

  // Mouse gesture blocks and root behaviours are rewritten section-by-section
  // because their body indent depends on the enclosing DT node — nested
  // blocks (e.g. `zip_mouse_gesture_mac` inside `/ { … }`) live at 8 spaces
  // while root-level blocks live at 4.
  let mgIdx = 0
  for (const section of parsed.sections) {
    if (section.kind === 'mouse-gesture-root' || section.kind === 'mouse-gesture-named') {
      const block = draft.mouseGestures[mgIdx++]
      if (block) {
        const bodyIndent = detectLineIndent(baseSource, section.headerRange[0]) + 4
        edits.push({
          range: section.bodyRange,
          replacement: serializeMouseGestureBlock(block, bodyIndent),
        })
      }
    }
  }

  let rbIdx = 0
  for (const section of parsed.sections) {
    if (section.kind === 'root-mt' || section.kind === 'root-lt') {
      const cfg = draft.rootBehaviors[rbIdx++]
      if (cfg) {
        const bodyIndent = detectLineIndent(baseSource, section.headerRange[0]) + 4
        edits.push({
          range: section.bodyRange,
          replacement: serializeRootBehavior(cfg, bodyIndent),
        })
      }
    }
  }

  return applyEdits(baseSource, edits)
}

export function patchKeymapContainer(
  parsed: ParsedKeymap,
  edits: Edit[],
  layers: EditorDraft['layers'],
): void {
  const container = parsed.sections.find((s) => s.kind === 'keymap-root')
  if (!container) return
  const lines: string[] = []
  lines.push('')
  lines.push(`${INDENT}compatible = "zmk,keymap";`)
  for (const layer of layers) {
    lines.push('')
    lines.push(`${INDENT}${layer.name} {${serializeLayer(layer)}};`)
  }
  lines.push('    ')
  edits.push({ range: container.bodyRange, replacement: lines.join('\n') })
}

export function patchCombosContainer(
  parsed: ParsedKeymap,
  edits: Edit[],
  combos: EditorDraft['combos'],
): void {
  const container = parsed.sections.find((s) => s.kind === 'combos-container')
  if (!container) return
  const lines: string[] = []
  lines.push('')
  lines.push(`${INDENT}compatible = "zmk,combos";`)
  for (const combo of combos) {
    lines.push('')
    lines.push(`${INDENT}${combo.name} {${serializeCombo(combo)}};`)
  }
  lines.push('    ')
  edits.push({ range: container.bodyRange, replacement: lines.join('\n') })
}

export function patchMacrosContainer(
  parsed: ParsedKeymap,
  edits: Edit[],
  macros: EditorDraft['macros'],
): void {
  const container = parsed.sections.find((s) => s.kind === 'macros-container')
  if (!container) return
  const lines: string[] = []
  lines.push('')
  for (let i = 0; i < macros.length; i++) {
    const macro = macros[i]
    // ZMK macros use `label: nodeName { … };` so `label` can be referenced
    // from bindings (e.g. `&esc_lang2`). Fresh entries from the UI have no
    // stored `nodeName`, so fall back to `name` — the effect is `label: label`.
    const nodeName = macro.nodeName ?? macro.name
    lines.push(`${INDENT}${macro.name}: ${nodeName} {${serializeMacro(macro)}};`)
    if (i < macros.length - 1) lines.push('')
  }
  lines.push('    ')
  edits.push({ range: container.bodyRange, replacement: lines.join('\n') })
}

export function patchBehaviorsContainer(
  parsed: ParsedKeymap,
  edits: Edit[],
  behaviors: EditorDraft['behaviors'],
): void {
  const container = parsed.sections.find((s) => s.kind === 'behaviors-container')
  if (!container) return
  const lines: string[] = []
  lines.push('')
  for (let i = 0; i < behaviors.length; i++) {
    const behavior = behaviors[i]
    const nodeName = behavior.nodeName ?? behavior.name
    lines.push(`${INDENT}${behavior.name}: ${nodeName} {${serializeBehavior(behavior)}};`)
    if (i < behaviors.length - 1) lines.push('')
  }
  lines.push('    ')
  edits.push({ range: container.bodyRange, replacement: lines.join('\n') })
}
