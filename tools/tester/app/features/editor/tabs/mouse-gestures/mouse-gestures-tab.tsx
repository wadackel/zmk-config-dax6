import { useState } from 'hono/jsx'
import { useEditor } from '../../../../core/editor-state/context'
import type {
  MouseGestureBlock,
  MouseGesturePattern,
  MouseGesturePatternEntry,
} from '../../../../core/keymap-dt/types'
import { DirectionPad, getDirectionMeta } from './direction-pad'
import { GestureBlockList } from './gesture-block-list'
import { GestureDock } from './gesture-inspector'
import { DockShell } from '../../shell/dock-shell'

const upsertEntry = (
  entries: MouseGesturePatternEntry[],
  pattern: MouseGesturePattern,
  entry: MouseGesturePatternEntry,
): MouseGesturePatternEntry[] => {
  const idx = entries.findIndex((e) => e.pattern === pattern)
  if (idx === -1) return [...entries, entry]
  return entries.map((e, i) => (i === idx ? entry : e))
}

/**
 * Mouse Gestures tab. Two-column shell + bottom dock:
 *   - Left: GestureBlockList (root override + named input-processor blocks)
 *   - Center: DirectionPad (4-direction cards + decorative trackball)
 *   - Bottom dock: GestureDock — per-block DT properties + per-direction
 *     binding editor. Swaps to a BindingDock dock variant while a
 *     binding is being edited.
 */
export function MouseGesturesTab() {
  const { state, dispatch } = useEditor()
  const blocks = state.draft.mouseGestures
  const [activeBlockIdx, setActiveBlockIdx] = useState(0)
  const [selected, setSelected] = useState<MouseGesturePattern | null>(null)

  const block = blocks[activeBlockIdx]

  if (blocks.length === 0 || !block) {
    return (
      <div class="flex-1 min-h-0 flex items-center justify-center text-fg-subtle text-sm">
        No mouse gesture blocks defined.
      </div>
    )
  }

  const onCreateDirection = (pattern: MouseGesturePattern) => {
    dispatch({
      type: 'UPDATE_MOUSE_GESTURE',
      index: activeBlockIdx,
      block: {
        ...block,
        entries: upsertEntry(block.entries, pattern, {
          name: getDirectionMeta(pattern).defaultName,
          pattern,
          bindings: { tokens: ['&none'] },
        }),
      },
    })
    setSelected(pattern)
  }

  const commitBlock = (next: MouseGestureBlock) => {
    dispatch({ type: 'UPDATE_MOUSE_GESTURE', index: activeBlockIdx, block: next })
  }

  return (
    <div class="flex-1 min-h-0 min-w-0 flex flex-col bg-surface-0">
      <div class="flex-1 min-h-0 flex overflow-hidden">
        <GestureBlockList
          blocks={blocks}
          activeIdx={activeBlockIdx}
          onSelect={(i) => {
            setActiveBlockIdx(i)
            setSelected(null)
          }}
        />

        <div class="flex-1 bg-surface-3 flex flex-col min-w-0 overflow-auto">
          <div class="flex items-center justify-between px-6 py-3 border-b border-border-subtle gap-4">
            <div class="flex items-baseline gap-3">
              <span class="text-[14px] font-mono font-semibold text-fg">
                {block.kind === 'root' ? '&zip_mouse_gesture' : (block.name ?? '(unnamed)')}
              </span>
              <span class="text-[11px] text-fg-subtle">
                {block.kind === 'root' ? 'root block' : 'named block'}
              </span>
            </div>
            <span class="text-[11px] font-medium leading-none text-fg-subtle">
              Assign a binding to each flick direction
            </span>
          </div>

          <div class="flex-1 flex items-center justify-center px-8 py-6 min-w-0">
            <DirectionPad
              block={block}
              selected={selected}
              onSelect={setSelected}
              onCreate={onCreateDirection}
            />
          </div>
        </div>
      </div>

      <DockShell ariaLabel="Gesture properties">
        <GestureDock
          block={block}
          selected={selected}
          onChange={commitBlock}
          onDeselect={() => setSelected(null)}
        />
      </DockShell>
    </div>
  )
}
