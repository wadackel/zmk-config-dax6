import { useState, useEffect, useCallback } from 'hono/jsx'
import { TesterIcon } from '../ui/nav-icons'
import { getBoard } from '../boards/active'
import { KEYS } from '../core/layout'
import type { KeyDef } from '../core/layout'
import { resolveKeyboardEvent, resolveMouseEvent } from '../core/keymap-input'
import { createInitialState, getProgress } from '../core/tester-state'
import type { TestState, KeyState, EventLogEntry } from '../core/tester-state'
import { CHATTER_THRESHOLD_MS, detectChattering } from '../core/chattering'
import { MICRO_LABEL } from '../ui/micro-label'

const LOG_MAX = 100
const CELL_SIZE = 54
const CELL_GAP = 7
const HALF_OFFSET = -(CELL_SIZE + CELL_GAP) / 2


type GridPos = { col: number; row: number; halfCol: boolean; halfRow: boolean }

function getGridPosition(k: KeyDef): GridPos {
  const halfCol = k.x % 1 !== 0
  const halfRow = k.y % 1 !== 0
  const col = halfCol ? Math.ceil(k.x) + 1 : k.x + 1
  const row = halfRow ? Math.ceil(k.y) + 1 : k.y + 1
  return { col, row, halfCol, halfRow }
}

type CellKind = 'untestable' | 'idle' | 'tested' | 'pressed' | 'chattering' | 'last'

function cellKind(
  keyDef: KeyDef,
  keyState: KeyState | undefined,
  isLast: boolean,
): CellKind {
  if (keyDef.testability === 'untestable') return 'untestable'
  if (keyState?.isPressed) return 'pressed'
  if (isLast) return 'last'
  if (keyState?.status === 'chattering') return 'chattering'
  if (keyState?.status === 'tested') return 'tested'
  return 'idle'
}

function GridKeyCell({
  keyDef,
  keyState,
  isLast,
}: {
  keyDef: KeyDef
  keyState: KeyState | undefined
  isLast: boolean
}) {
  const kind = cellKind(keyDef, keyState, isLast)
  const pos = getGridPosition(keyDef)

  const tx = pos.halfCol ? HALF_OFFSET : 0
  const ty = pos.halfRow ? HALF_OFFSET : 0
  const halfTranslate = tx !== 0 || ty !== 0 ? `translate(${tx}px,${ty}px)` : ''
  const gridStyle = `grid-column-start:${pos.col};grid-row-start:${pos.row};width:${CELL_SIZE}px;height:${CELL_SIZE}px;`

  let bg = '#ffffff'
  let border = '1px solid rgba(22,24,29,.12)'
  let shadow = '0 1px 2px rgba(22,24,29,.05)'
  let mainColor = '#16181d'
  let tagColor = '#b6bac2'
  let transform = 'none'
  let borderStyle = 'solid'

  if (kind === 'untestable') {
    bg = '#fafafa'
    border = '1.5px dashed rgba(22,24,29,.28)'
    borderStyle = 'dashed'
    shadow = 'none'
    mainColor = '#bcc0c8'
    tagColor = '#d0d3d9'
  } else if (kind === 'pressed' || kind === 'last') {
    bg = '#4f5b6b'
    border = '2px solid #4f5b6b'
    shadow = '0 4px 12px rgba(79,91,107,.32)'
    mainColor = '#ffffff'
    tagColor = 'rgba(255,255,255,.6)'
    transform = 'translateY(1px)'
  } else if (kind === 'chattering') {
    bg = 'rgba(180,84,47,.1)'
    border = '1.5px solid rgba(180,84,47,.5)'
    shadow = 'none'
    mainColor = '#b4542f'
    tagColor = 'rgba(180,84,47,.6)'
  } else if (kind === 'tested') {
    bg = 'rgba(79,91,107,.1)'
    border = '1.5px solid rgba(79,91,107,.36)'
    shadow = 'none'
    mainColor = '#4f5b6b'
    tagColor = 'rgba(79,91,107,.55)'
  }

  const label = keyDef.label
  const mainSize = label.length > 3 ? 12 : label.length > 1 ? 14 : 15
  const showCheck = kind === 'tested'
  const showChatterBadge = kind === 'chattering' && (keyState?.chatterCount ?? 0) > 0

  const composedTransform = [halfTranslate, transform !== 'none' ? transform : '']
    .filter(Boolean)
    .join(' ') || 'none'
  const inlineStyle =
    `${gridStyle}` +
    `background:${bg};` +
    `border:${border};` +
    `border-style:${borderStyle};` +
    `border-radius:7px;` +
    `box-shadow:${shadow};` +
    `transform:${composedTransform};`

  return (
    <div
      data-key={keyDef.index}
      class="relative flex flex-col items-stretch p-[5px] box-border select-none transition-[transform,box-shadow] duration-75"
      style={inlineStyle}
    >
      <span
        class="font-mono text-[8.5px] leading-none tracking-[.03em] self-start"
        style={`color:${tagColor};`}
      >
        {label}
      </span>
      <span
        class="font-mono font-semibold leading-none m-auto"
        style={`font-size:${mainSize}px;color:${mainColor};`}
      >
        {label}
      </span>
      <span class="h-[10px] w-full flex items-center justify-center">
        {showCheck && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 12 12"
            fill="none"
            stroke={mainColor}
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M2 6.5 4.8 9.5 10 3" />
          </svg>
        )}
      </span>
      {showChatterBadge && (
        <span
          class="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[9px] font-bold leading-none px-1"
          style="background:#b4542f;color:#fff;"
          aria-label={`chatter count ${keyState?.chatterCount ?? 0}`}
        >
          {keyState?.chatterCount ?? 0}
        </span>
      )}
    </div>
  )
}

function LastKeypressPanel({
  keyDef,
  keyState,
}: {
  keyDef: KeyDef | null
  keyState: KeyState | undefined
}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      class="px-[22px] pt-[20px] pb-4 border-b border-border-subtle"
    >
      <span class={`${MICRO_LABEL} block mb-3`}>LAST KEYPRESS</span>
      {keyDef ? (
        <div class="flex items-center gap-[14px]">
          <div
            class="w-[60px] h-[60px] flex-none flex items-center justify-center rounded-[8px] box-border"
            style="border:1.5px solid #4f5b6b;background:rgba(79,91,107,.08);box-shadow:0 0 0 3px rgba(79,91,107,.12);"
          >
            <span
              class="font-mono font-semibold leading-none text-fg"
              style={`font-size:${keyDef.label.length > 3 ? 12 : 20}px;`}
            >
              {keyDef.label}
            </span>
          </div>
          <div class="flex flex-col gap-[5px] min-w-0">
            <span class="font-mono font-semibold text-[14px] leading-none text-fg truncate">
              {keyDef.label}
            </span>
            <span class="font-mono font-medium text-[11px] leading-none text-fg-subtle">
              pos {keyDef.index} · row {keyDef.y} col {keyDef.x}
              {keyState?.chatterCount ? ` · ${keyState.chatterCount} chatter` : ''}
            </span>
          </div>
        </div>
      ) : (
        <span class="text-[12.5px] leading-[1.5] text-fg-subtler">No key pressed yet.</span>
      )}
    </div>
  )
}

function CoveragePanel({
  tested,
  total,
  percent,
}: {
  tested: number
  total: number
  percent: number
}) {
  return (
    <div class="px-[22px] py-[18px] border-b border-border-subtle">
      <div class="flex items-baseline justify-between mb-[10px]">
        <span class={MICRO_LABEL}>COVERAGE</span>
        <span class="font-mono font-semibold text-[12px] leading-none text-fg-muted">
          {tested} / {total}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Test coverage"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        class="h-[8px] rounded-full overflow-hidden"
        style="background:rgba(22,24,29,.07);"
      >
        <div
          class="h-full rounded-full transition-[width] duration-200"
          style={`width:${percent}%;background:#4f5b6b;`}
        />
      </div>
      <span class="block mt-[9px] text-[11px] leading-[1.4] text-fg-subtle">
        {tested === total
          ? 'Every key has registered at least once.'
          : `${total - tested} keys still need a press.`}
      </span>
    </div>
  )
}

function ChatterPanel({
  chatterCount,
  chatterKeyLabels,
}: {
  chatterCount: number
  chatterKeyLabels: string[]
}) {
  const ok = chatterCount === 0
  return (
    <div class="px-[22px] py-[18px] border-b border-border-subtle">
      <span class={`${MICRO_LABEL} block mb-[11px]`}>CHATTER DETECTION</span>
      {ok ? (
        <div
          role="status"
          class="flex items-center gap-[9px] px-[13px] py-[11px] rounded-[8px] box-border"
          style="background:rgba(63,122,82,.07);border:1px solid rgba(63,122,82,.18);"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            stroke="#3f7a52"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M3 8.5 6.5 12 13 4" />
          </svg>
          <span
            class="font-semibold text-[12.5px] leading-[1.3]"
            style="color:#2f6641;"
          >
            No chatter detected
          </span>
        </div>
      ) : (
        <div
          role="alert"
          class="flex flex-col gap-[6px] px-[13px] py-[11px] rounded-[8px] box-border"
          style="background:rgba(180,84,47,.08);border:1px solid rgba(180,84,47,.28);"
        >
          <span
            class="inline-flex items-center gap-2 font-semibold text-[12.5px] leading-[1.3]"
            style="color:#9a4527;"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              stroke="#b4542f"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M8 1.6 1 13.4h14L8 1.6Z" />
              <path d="M8 6.4v3.1M8 11.4h.01" />
            </svg>
            Chatter detected
          </span>
          <span
            class="text-[11px] leading-[1.5]"
            style="color:#a05235;"
          >
            {chatterCount} rapid re-trigger{chatterCount === 1 ? '' : 's'} on{' '}
            <span
              class="font-mono font-semibold text-[11px] leading-[1.5]"
              style="color:#a05235;"
            >
              {chatterKeyLabels.join(', ')}
            </span>{' '}
            — bounces under {CHATTER_THRESHOLD_MS} ms.
          </span>
        </div>
      )}
    </div>
  )
}

type LogRow = {
  id: number
  tag: string
  main: string
  isChattering: boolean
  gap: string
  rowBg: string
  tagColor: string
  mainColor: string
  gapColor: string
}

function KeypressLogPanel({
  rows,
  totalCount,
}: {
  rows: LogRow[]
  totalCount: number
}) {
  return (
    <div class="flex-1 min-h-0 flex flex-col px-[22px] py-[18px]">
      <div class="flex items-baseline justify-between mb-[11px]">
        <span class={MICRO_LABEL}>KEYPRESS LOG</span>
        <span class="font-mono font-medium text-[10.5px] leading-none text-fg-subtle">
          {totalCount} event{totalCount === 1 ? '' : 's'}
        </span>
      </div>
      <div
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        class="flex-1 min-h-0 overflow-y-auto"
      >
        {rows.length === 0 ? (
          <span class="text-[12px] leading-[1.5] text-fg-subtler">
            Nothing logged yet. Press keys to record them.
          </span>
        ) : (
          <div class="flex flex-col gap-[3px]">
            {rows.map((r) => (
              <div
                key={r.id}
                class="flex items-center gap-[10px] px-[10px] py-[7px] rounded-[6px] box-border"
                style={`background:${r.rowBg};`}
              >
                <span
                  class="font-mono font-semibold text-[8px] leading-none"
                  style={`color:${r.tagColor};width:30px;`}
                >
                  {r.tag}
                </span>
                <span
                  class="font-mono font-semibold text-[12.5px] leading-none"
                  style={`color:${r.mainColor};`}
                >
                  {r.main}
                </span>
                {r.isChattering && (
                  <span
                    class="font-mono font-semibold text-[8.5px] leading-none uppercase tracking-[.05em] px-[6px] py-[2px] rounded-[4px]"
                    style="color:#b4542f;background:rgba(180,84,47,.12);"
                  >
                    CHATTER
                  </span>
                )}
                <span
                  class="ml-auto font-mono font-medium text-[10.5px] leading-none"
                  style={`color:${r.gapColor};`}
                >
                  {r.gap}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function InlineNav() {
  return (
    <nav
      aria-label="Primary"
      class="w-[62px] flex-none border-r border-border-subtle flex flex-col items-center py-4 gap-[10px] bg-surface-2"
    >
      <div
        class="w-[32px] h-[32px] flex items-center justify-center rounded-[6px] font-mono font-bold text-[9.5px] leading-none tracking-[-.02em]"
        style="background:#16181d;color:#fff;"
        aria-hidden="true"
      >
        zmk
      </div>
      <a
        href="/"
        title="Back to editor"
        class="w-[42px] h-[40px] flex flex-col items-center justify-center gap-[3px] rounded-[6px] text-fg-subtle hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M9.5 3 4.5 8l5 5" />
        </svg>
        <span class="font-medium text-[8px] leading-none">Editor</span>
      </a>
      <div class="w-full h-px my-[2px] bg-border-subtle" aria-hidden="true" />
      <a
        href="/tester"
        aria-current="page"
        class="w-[42px] h-[44px] flex flex-col items-center justify-center gap-[3px] rounded-[6px] text-fg"
        style="background:rgba(22,24,29,.08);"
      >
        <TesterIcon />
        <span class="font-semibold text-[8px] leading-none">Tester</span>
      </a>
    </nav>
  )
}

export default function KeyboardTester() {
  const [state, setState] = useState<TestState>(() => createInitialState())

  useEffect(() => {
    const addLogEntry = (
      prev: TestState,
      type: EventLogEntry['type'],
      label: string,
      isChattering: boolean,
    ): EventLogEntry[] => {
      const newEntry: EventLogEntry = {
        id: prev.logIdCounter,
        timestamp: Date.now(),
        type,
        label,
        isChattering,
      }
      const newLog = [...prev.eventLog, newEntry]
      if (newLog.length > LOG_MAX) {
        return newLog.slice(newLog.length - LOG_MAX)
      }
      return newLog
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return

      const keyDef = resolveKeyboardEvent(e)
      if (!keyDef) {
        setState((prev) => ({
          ...prev,
          eventLog: addLogEntry(prev, 'keydown', `? code=${e.code} key=${e.key}`, false),
          logIdCounter: prev.logIdCounter + 1,
        }))
        return
      }

      e.preventDefault()

      const now = Date.now()

      setState((prev) => {
        const newKeys = new Map(prev.keys)
        const existing = newKeys.get(keyDef.index)
        if (!existing) return prev

        const keyState = { ...existing }
        const chatter = detectChattering(keyState.lastKeyupTime, now)

        keyState.isPressed = true
        keyState.pressCount += 1
        keyState.lastKeydownTime = now

        if (chatter.isChattering) {
          keyState.status = 'chattering'
          keyState.chatterCount += 1
        } else if (keyState.status !== 'chattering') {
          keyState.status = 'pressed'
        }

        newKeys.set(keyDef.index, keyState)

        const testedCount = countTested(newKeys)

        return {
          ...prev,
          keys: newKeys,
          testedCount,
          lastKeyIndex: keyDef.index,
          eventLog: addLogEntry(
            prev,
            'keydown',
            keyDef.label,
            chatter.isChattering,
          ),
          logIdCounter: prev.logIdCounter + 1,
        }
      })
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const keyDef = resolveKeyboardEvent(e)
      if (!keyDef) {
        setState((prev) => ({
          ...prev,
          eventLog: addLogEntry(prev, 'keyup', `? code=${e.code} key=${e.key}`, false),
          logIdCounter: prev.logIdCounter + 1,
        }))
        return
      }

      e.preventDefault()

      const now = Date.now()

      setState((prev) => {
        const newKeys = new Map(prev.keys)
        const existing = newKeys.get(keyDef.index)
        if (!existing) return prev

        const keyState = { ...existing }
        keyState.isPressed = false
        keyState.lastKeyupTime = now

        if (keyState.status === 'pressed') {
          keyState.status = 'tested'
        }

        newKeys.set(keyDef.index, keyState)

        const testedCount = countTested(newKeys)

        return {
          ...prev,
          keys: newKeys,
          testedCount,
          eventLog: addLogEntry(prev, 'keyup', keyDef.label, false),
          logIdCounter: prev.logIdCounter + 1,
        }
      })
    }

    const handleMouseDown = (e: MouseEvent) => {
      const keyDef = resolveMouseEvent(e)
      if (!keyDef) return

      const now = Date.now()

      setState((prev) => {
        const newKeys = new Map(prev.keys)
        const existing = newKeys.get(keyDef.index)
        if (!existing) return prev

        const keyState = { ...existing }
        const chatter = detectChattering(keyState.lastKeyupTime, now)

        keyState.isPressed = true
        keyState.pressCount += 1
        keyState.lastKeydownTime = now

        if (chatter.isChattering) {
          keyState.status = 'chattering'
          keyState.chatterCount += 1
        } else if (keyState.status !== 'chattering') {
          keyState.status = 'pressed'
        }

        newKeys.set(keyDef.index, keyState)

        const testedCount = countTested(newKeys)

        return {
          ...prev,
          keys: newKeys,
          testedCount,
          lastKeyIndex: keyDef.index,
          eventLog: addLogEntry(
            prev,
            'mousedown',
            keyDef.label,
            chatter.isChattering,
          ),
          logIdCounter: prev.logIdCounter + 1,
        }
      })
    }

    const handleMouseUp = (e: MouseEvent) => {
      const keyDef = resolveMouseEvent(e)
      if (!keyDef) return

      const now = Date.now()

      setState((prev) => {
        const newKeys = new Map(prev.keys)
        const existing = newKeys.get(keyDef.index)
        if (!existing) return prev

        const keyState = { ...existing }
        keyState.isPressed = false
        keyState.lastKeyupTime = now

        if (keyState.status === 'pressed') {
          keyState.status = 'tested'
        }

        newKeys.set(keyDef.index, keyState)

        const testedCount = countTested(newKeys)

        return {
          ...prev,
          keys: newKeys,
          testedCount,
          eventLog: addLogEntry(prev, 'mouseup', keyDef.label, false),
          logIdCounter: prev.logIdCounter + 1,
        }
      })
    }

    const handleContextMenu = (e: Event) => {
      e.preventDefault()
    }

    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('keyup', handleKeyUp, true)
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('contextmenu', handleContextMenu)

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('keyup', handleKeyUp, true)
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [])

  const { tested, total, percent } = getProgress(state)

  const handleReset = useCallback(() => {
    setState(createInitialState())
  }, [])

  const lastKeyDef =
    state.lastKeyIndex != null
      ? KEYS.find((k) => k.index === state.lastKeyIndex) ?? null
      : null
  const lastKeyState =
    state.lastKeyIndex != null ? state.keys.get(state.lastKeyIndex) : undefined

  const chatterEvents = state.eventLog.filter((e) => e.isChattering)
  const chatterCount = chatterEvents.length
  const chatterKeyLabels = Array.from(new Set(chatterEvents.map((e) => e.label)))

  const logRows: LogRow[] = [...state.eventLog].reverse().map((ev, idxRev) => {
    const idx = state.eventLog.length - 1 - idxRev
    const prevT = idx > 0 ? state.eventLog[idx - 1].timestamp : null
    const gapMs = prevT != null ? ev.timestamp - prevT : null
    const gap =
      gapMs == null || gapMs > 5000 || gapMs < 0 ? '—' : `+${gapMs}ms`
    return {
      id: ev.id,
      tag: ev.type.toUpperCase(),
      main: ev.label,
      isChattering: ev.isChattering,
      gap,
      rowBg: ev.isChattering ? 'rgba(180,84,47,.08)' : 'transparent',
      mainColor: ev.isChattering ? '#9a4527' : '#16181d',
      tagColor: ev.isChattering ? 'rgba(180,84,47,.6)' : '#b6bac2',
      gapColor: ev.isChattering ? '#b4542f' : '#9aa0aa',
    }
  })

  return (
    <div class="h-screen w-full flex bg-surface-0 text-fg">
      <InlineNav />

      <div class="flex-1 min-w-0 flex flex-col">
        <header class="border-b border-border-subtle flex items-center justify-between px-6 py-3.5 gap-4">
          <div class="flex items-center gap-[14px] min-w-0">
            <a
              href="/"
              class="inline-flex items-center gap-1.5 font-medium text-[12.5px] leading-none text-fg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
            >
              <span class="text-[13px] leading-none" aria-hidden="true">←</span>
              Editor
            </a>
            <span class="w-px h-4 bg-border" aria-hidden="true" />
            <h1 class="text-[17px] font-bold m-0 tracking-tight">Keyboard Tester</h1>
            <span class="text-[11px] font-mono text-fg-subtle">
              {getBoard().branding.shortLabel} · {KEYS.length} keys · {tested}/{total} tested · {percent}%
            </span>
          </div>
          <button
            type="button"
            onMouseDown={(e: MouseEvent) => e.stopPropagation()}
            onClick={handleReset}
            title="Reset all key statuses"
            class="px-[15px] py-[8px] rounded-[6px] border border-border bg-surface-0 font-medium text-[12.5px] leading-none text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Reset test
          </button>
        </header>

        <main
          id="tester-main"
          aria-label="Keyboard tester"
          class="flex-1 min-h-0 min-w-0 flex flex-col justify-center gap-[22px] px-3 py-6 overflow-auto"
          style="background:var(--color-surface-3);"
        >
          <div
            class="inline-grid mx-auto"
            style={`grid-template-columns:repeat(${getBoard().grid.testerGridInterleaveCols},${CELL_SIZE}px);grid-auto-rows:${CELL_SIZE}px;gap:${CELL_GAP}px;`}
          >
            {KEYS.map((keyDef) => (
              <GridKeyCell
                key={keyDef.index}
                keyDef={keyDef}
                keyState={state.keys.get(keyDef.index)}
                isLast={state.lastKeyIndex === keyDef.index}
              />
            ))}
          </div>
          <span class="text-[11px] leading-[1.5] text-fg-subtle font-medium">
            Press each key on your keyboard — registered keys turn accent. Click a key here
            to simulate a press.
          </span>
        </main>
      </div>

      <aside
        aria-label="Tester readout"
        class="w-[320px] flex-none bg-surface-0 border-l border-border-subtle flex flex-col box-border"
      >
        <LastKeypressPanel keyDef={lastKeyDef} keyState={lastKeyState} />
        <CoveragePanel tested={tested} total={total} percent={percent} />
        <ChatterPanel chatterCount={chatterCount} chatterKeyLabels={chatterKeyLabels} />
        <KeypressLogPanel rows={logRows} totalCount={state.eventLog.length} />
      </aside>
    </div>
  )
}

function countTested(keys: Map<number, KeyState>): number {
  let count = 0
  keys.forEach((k) => {
    if (k.status === 'tested' || k.status === 'chattering') count += 1
  })
  return count
}
