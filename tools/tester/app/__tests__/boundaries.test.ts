// Layer-boundary regression guard. Enforces the import direction contract:
//
//   ui       → ui only
//   core     → core (+ boards/active for the getBoard() runtime pattern)
//   boards   → core, boards
//   features → ui, core, boards, features
//   routes   → features, ui, core, boards, islands (HonoX), infra (reload-guard)
//   islands  → ui, features, core, boards
//   infra    → boards/dax6/* (config-load), core (types), infra
//
// A previous refactor left two silent violations (ui/dialog importing from
// core/, tester island importing from features/editor); this test would have
// caught both on introduction, and prevents equivalents from creeping back.
//
// Two edges look like violations but are load-bearing product patterns:
//   - `routes → islands` is the whole point of HonoX composition; the routes
//     wrap island entries for hydration.
//   - `routes → codegen/reload-guard` suppresses HMR on the /api/keymap save
//     path so a successful write does not immediately full-reload the editor.
//     The reload-guard lives in codegen/ because that is where the HMR
//     watcher fires; the /api route shares the same shim.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

type Layer = 'ui' | 'core' | 'boards' | 'features' | 'routes' | 'islands' | 'infra'

const ROOT = path.resolve(__dirname, '../..')

const ROOTS: Record<Layer, string[]> = {
  ui: ['app/ui'],
  core: ['app/core'],
  boards: ['app/boards'],
  features: ['app/features'],
  routes: ['app/routes'],
  islands: ['app/islands'],
  infra: ['codegen', 'vite-plugins'],
}

const ALLOW: Record<Layer, Layer[]> = {
  ui: ['ui'],
  core: ['core', 'boards'],
  boards: ['core', 'boards'],
  features: ['ui', 'core', 'boards', 'features'],
  routes: ['ui', 'core', 'boards', 'features', 'routes', 'islands', 'infra'],
  islands: ['ui', 'core', 'boards', 'features', 'islands'],
  infra: ['core', 'boards', 'infra'],
}

// A `core → boards` import is only allowed for the singleton runtime access
// pattern (`boards/active`), NOT for reaching into a specific board profile.
// Every other core→boards edge would collapse the "core is board-agnostic"
// contract.
const CORE_TO_BOARDS_ALLOW_TARGETS = new Set(['boards/active'])

function walk(dir: string): string[] {
  const abs = path.resolve(ROOT, dir)
  const out: string[] = []
  const entries = readdirSync(abs)
  for (const name of entries) {
    if (name === 'node_modules' || name === '__fixtures__' || name === '__test-mock__') continue
    const p = path.join(abs, name)
    const st = statSync(p)
    if (st.isDirectory()) {
      out.push(...walk(path.relative(ROOT, p)))
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(path.relative(ROOT, p))
    }
  }
  return out
}

function layerOf(fileRel: string): Layer | null {
  for (const [layer, roots] of Object.entries(ROOTS) as [Layer, string[]][]) {
    for (const r of roots) {
      if (fileRel === r || fileRel.startsWith(r + path.sep)) return layer
    }
  }
  return null
}

function resolveImport(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null
  const fromDir = path.dirname(path.resolve(ROOT, fromFile))
  const abs = path.resolve(fromDir, spec)
  return path.relative(ROOT, abs)
}

// Which layer does a resolved import path belong to? We match by the layer's
// root directories, mirroring `layerOf` but on the (extension-less) resolved
// path.
function targetLayer(resolvedPath: string): Layer | null {
  for (const [layer, roots] of Object.entries(ROOTS) as [Layer, string[]][]) {
    for (const r of roots) {
      if (resolvedPath === r || resolvedPath.startsWith(r + path.sep)) return layer
    }
  }
  return null
}

const IMPORT_RE = /^\s*(?:import|export)[^'"\n]*?\bfrom\s+['"]([^'"]+)['"]/gm

type Violation = {
  from: string
  fromLayer: Layer
  spec: string
  target: string
  targetLayer: Layer
}

function scan(): Violation[] {
  const violations: Violation[] = []
  const files: string[] = []
  for (const roots of Object.values(ROOTS)) {
    for (const r of roots) files.push(...walk(r))
  }
  for (const file of files) {
    const fromLayer = layerOf(file)
    if (!fromLayer) continue
    const src = readFileSync(path.resolve(ROOT, file), 'utf8')
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1]
      const resolved = resolveImport(file, spec)
      if (!resolved) continue
      const tLayer = targetLayer(resolved)
      if (!tLayer) continue
      if (ALLOW[fromLayer].includes(tLayer)) {
        // Narrow the `core → boards` edge to boards/active only.
        if (fromLayer === 'core' && tLayer === 'boards') {
          const rel = path.relative('app/boards', resolved)
          const first = rel.split(path.sep)[0] // e.g. "active" from "active" or "dax6"
          if (!CORE_TO_BOARDS_ALLOW_TARGETS.has(`boards/${first}`)) {
            violations.push({ from: file, fromLayer, spec, target: resolved, targetLayer: tLayer })
          }
        }
        continue
      }
      violations.push({ from: file, fromLayer, spec, target: resolved, targetLayer: tLayer })
    }
  }
  return violations
}

describe('layer boundaries', () => {
  it('every relative import respects the layer contract', () => {
    const violations = scan()
    // Print details on failure so the caller can see what edge broke.
    if (violations.length > 0) {
      const lines = violations.map(
        (v) => `${v.fromLayer}(${v.from}) → ${v.targetLayer}(${v.target}) via ${v.spec}`,
      )
      throw new Error(`Boundary violations:\n${lines.join('\n')}`)
    }
    expect(violations).toEqual([])
  })
})
