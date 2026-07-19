import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import { keymapSource } from '../app/boards/dax6/keymap-source'
import type { BindingChain } from '../app/core/keymap-dt/types'
import { isReloadSuppressed } from './reload-guard'
import { resolveEncoders, resolveKeys, type ParsedBinding } from './resolve'

const VIRTUAL_MODULE_ID = 'virtual:zmk-layout'
const RESOLVED_ID = '\0' + VIRTUAL_MODULE_ID

interface PhysicalLayoutJson {
  layouts: {
    default_layout: {
      layout: Array<{ x: number; y: number }>
    }
  }
  sensors: Array<{ ref: string }>
}

function chainToParsedBinding(chain: BindingChain): ParsedBinding {
  // BindingChain.tokens[0] is the behaviour name with leading `&` (e.g. `&kp`).
  const behaviorWithAmp = chain.tokens[0] ?? ''
  return {
    behavior: behaviorWithAmp.startsWith('&') ? behaviorWithAmp.slice(1) : behaviorWithAmp,
    args: chain.tokens.slice(1),
  }
}

export function zmkLayout(): Plugin {
  let repoRoot: string

  const getSourceFiles = () => ({
    jsonPath: path.join(repoRoot, keymapSource.jsonRelative),
    keymapPath: path.join(repoRoot, keymapSource.keymapRelative),
  })

  const generateModule = async () => {
    // Dynamic imports defer loading of parse.ts and boards/dax6/matrix (and
    // their transitive board-profile chain) until plugin `load()` fires. Top-
    // level imports here would pull `virtual:zmk-layout` at Node ESM config-
    // load time, before Vite has registered any plugins that can resolve it.
    const { parseKeymap } = await import('../app/core/keymap-dt/parse')
    const { matrix: dax6Matrix } = await import('../app/boards/dax6/matrix')
    const { jsonPath, keymapPath } = getSourceFiles()
    const layout = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as PhysicalLayoutJson
    const keymapContent = fs.readFileSync(keymapPath, 'utf-8')

    const physicalLayout = layout.layouts.default_layout.layout
    const parsed = parseKeymap(keymapContent)
    const defaultLayer = parsed.layers.find((l) => l.name === keymapSource.defaultLayerName)
    if (!defaultLayer) {
      throw new Error(`zmkLayout: ${keymapSource.defaultLayerName} not found in keymap`)
    }
    // A drift between the physical layout (dax6.json) and the matrix TRANSFORM
    // silently produces mis-indexed keys, so fail the build before resolveKeys
    // ever runs on mismatched data.
    if (!dax6Matrix.checkIntegrity(physicalLayout.length)) {
      throw new Error(
        `zmkLayout: physical layout has ${physicalLayout.length} keys but the matrix TRANSFORM expects ${dax6Matrix.keyCount}`,
      )
    }
    const bindings: ParsedBinding[] = defaultLayer.bindings.map(chainToParsedBinding)
    const keys = resolveKeys(physicalLayout, bindings)
    const encoders = resolveEncoders(layout.sensors)
    const testableCount = keys.filter(k => k.testability !== 'untestable').length

    return [
      `export const KEYS = ${JSON.stringify(keys, null, 2)}`,
      `export const ENCODERS = ${JSON.stringify(encoders, null, 2)}`,
      `export const TESTABLE_KEY_COUNT = ${testableCount}`,
    ].join('\n')
  }

  return {
    name: 'zmk-layout',

    configResolved(config) {
      // Vite root = tools/tester/, repo root is 2 levels up
      repoRoot = path.resolve(config.root, '../..')
    },

    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_ID
    },

    async load(id) {
      if (id !== RESOLVED_ID) return
      return await generateModule()
    },

    configureServer(server) {
      const { jsonPath, keymapPath } = getSourceFiles()
      const watchFiles = [jsonPath, keymapPath]

      for (const file of watchFiles) {
        server.watcher.add(file)
      }

      server.watcher.on('change', (changedPath) => {
        if (!watchFiles.includes(changedPath)) return
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
        if (isReloadSuppressed()) return
        server.ws.send({ type: 'full-reload' })
      })
    },
  }
}
