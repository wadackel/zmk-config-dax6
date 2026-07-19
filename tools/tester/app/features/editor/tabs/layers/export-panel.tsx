import { useEffect, useId, useRef, useState } from 'hono/jsx'
import type { Child } from 'hono/jsx'
import { getBoard } from '../../../../boards/active'
import { KEYS } from '../../../../core/layout'
import type { EditorDraft } from '../../../../core/editor-state/types'
import type { LayerData } from '../../../../core/keymap-dt/types'
import {
  copyKeymapToClipboard,
  downloadKeymapPng,
  type ExportArgs,
} from '../../../../core/keymap-image/export'
import type { BgKind, LayoutKind } from '../../../../core/keymap-image/canvas'
import { useToast } from '../../../../ui/toast'
import { MICRO_LABEL } from '../../../../ui/micro-label'

const errMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err)

export type ExportPanelProps = {
  layers: LayerData[]
  draft: EditorDraft
  onClose: () => void
}

export function ExportPanel({ layers, draft, onClose }: ExportPanelProps) {
  const toast = useToast()
  const [sel, setSel] = useState<number[]>(() => layers.map((_, i) => i))
  const [layout, setLayout] = useState<LayoutKind>('stack')
  const [bg, setBg] = useState<BgKind>('light')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const scopeLabelId = useId()
  const layoutLabelId = useId()
  const bgLabelId = useId()

  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(t)
  }, [copied])

  const total = layers.length
  const n = sel.length
  const allSelected = n === total && total > 0
  const disabled = n === 0 || busy

  const toggle = (i: number) => {
    setSel((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort((a, b) => a - b),
    )
    setCopied(false)
  }

  const toggleAll = () => {
    setSel(allSelected ? [] : layers.map((_, i) => i))
    setCopied(false)
  }

  const currentArgs = (): ExportArgs => ({
    draft,
    selection: sel,
    layout,
    bg,
    keys: KEYS,
  })

  const onCopy = async () => {
    if (disabled) return
    setBusy(true)
    try {
      await copyKeymapToClipboard(currentArgs())
      setCopied(true)
    } catch (err) {
      toast.push({
        tone: 'danger',
        message: 'Copy failed',
        detail:
          errMessage(err) ||
          'Clipboard write was rejected. Try Download PNG instead.',
      })
    } finally {
      setBusy(false)
    }
  }

  const onDownload = async () => {
    if (disabled) return
    setBusy(true)
    try {
      await downloadKeymapPng(currentArgs(), getBoard().branding.pngFileName)
      toast.push({ tone: 'success', message: 'PNG downloaded' })
    } catch (err) {
      toast.push({
        tone: 'danger',
        message: 'Download failed',
        detail: errMessage(err),
      })
    } finally {
      setBusy(false)
    }
  }

  const layoutSummary =
    n === 0
      ? 'Select at least one layer'
      : `Exporting ${n} layer${n === 1 ? '' : 's'}, ${
          layout === 'stack' ? 'stacked vertically' : 'in a 2-column grid'
        }`

  return (
    <aside
      aria-label="Export as image"
      class="w-[352px] flex-none bg-surface-0 border-l border-border-subtle shadow-[-14px_0_34px_rgba(22,24,29,.06)] flex flex-col box-border"
    >
      <div class="flex items-start justify-between px-[22px] py-[18px] border-b border-border-subtle">
        <div class="flex flex-col gap-1">
          <span class="text-[16px] font-bold leading-[1.1] text-fg">Export as image</span>
          <span class="text-[12px] leading-[1.4] text-fg-subtle">
            Stack selected layers into one image
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close export panel"
          class="text-[15px] leading-none text-fg-subtler hover:text-fg cursor-pointer"
        >
          ✕
        </button>
      </div>

      <div class="flex-1 overflow-auto px-[22px] py-[18px]">
        <div class="flex items-center justify-between mb-[11px]">
          <span id={scopeLabelId} class={MICRO_LABEL}>SCOPE</span>
          <button
            type="button"
            onClick={toggleAll}
            class="text-[11px] font-medium leading-none text-accent hover:brightness-95 cursor-pointer"
          >
            {allSelected ? 'Clear all' : 'Select all'}
          </button>
        </div>

        <ul
          aria-labelledby={scopeLabelId}
          class="flex flex-col gap-[2px] m-0 p-0 list-none"
        >
          {layers.map((layer, i) => {
            const on = sel.includes(i)
            const count = layer.bindings.length
            return (
              <li key={`${layer.name}-${i}`}>
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  aria-pressed={on ? 'true' : 'false'}
                  aria-label={`${on ? 'Deselect' : 'Select'} layer ${layer.name}`}
                  class={[
                    'w-full flex items-center gap-[11px] px-[11px] py-[9px] rounded-[7px] cursor-pointer transition-colors box-border text-left',
                    on
                      ? 'bg-[rgba(79,91,107,.06)] border border-[rgba(79,91,107,.14)]'
                      : 'border border-transparent hover:bg-surface-2',
                  ].join(' ')}
                >
                  <span
                    aria-hidden="true"
                    class={[
                      'w-[18px] h-[18px] flex-none rounded-[5px] flex items-center justify-center box-border',
                      on
                        ? 'bg-accent border-[1.5px] border-accent'
                        : 'bg-white border-[1.5px] border-[rgba(22,24,29,.22)]',
                    ].join(' ')}
                  >
                    {on && (
                      <span class="text-[11px] font-bold leading-none text-accent-fg">
                        ✓
                      </span>
                    )}
                  </span>
                  <span class="text-[11px] font-mono font-semibold leading-none text-fg-subtle w-[12px]">
                    {i}
                  </span>
                  <span
                    class={[
                      'text-[13px] font-medium leading-none flex-1 truncate',
                      on ? 'text-fg' : 'text-fg-muted',
                    ].join(' ')}
                  >
                    {layer.name}
                  </span>
                  <span class="text-[10.5px] font-mono font-medium leading-none text-fg-subtle">
                    {count}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <span id={layoutLabelId} class={`${MICRO_LABEL} block mt-[22px] mb-[11px]`}>
          LAYOUT
        </span>
        <div role="group" aria-labelledby={layoutLabelId} class="flex gap-2">
          <LayoutSwatch
            label="Stacked"
            active={layout === 'stack'}
            onClick={() => setLayout('stack')}
            preview={<StackedPreview active={layout === 'stack'} />}
          />
          <LayoutSwatch
            label="Grid"
            active={layout === 'grid'}
            onClick={() => setLayout('grid')}
            preview={<GridPreview active={layout === 'grid'} />}
          />
        </div>

        <span id={bgLabelId} class={`${MICRO_LABEL} block mt-[22px] mb-[11px]`}>
          BACKGROUND
        </span>
        <div role="group" aria-labelledby={bgLabelId} class="flex gap-2">
          <BgSwatch label="Light" active={bg === 'light'} onClick={() => setBg('light')} />
          <BgSwatch label="Dark" active={bg === 'dark'} onClick={() => setBg('dark')} />
          <BgSwatch
            label="Transparent"
            active={bg === 'transparent'}
            onClick={() => setBg('transparent')}
          />
        </div>

        <div
          role="status"
          aria-live="polite"
          class="mt-[22px] px-[12px] py-[11px] rounded-[8px] bg-surface-3"
        >
          <span class="text-[11px] font-medium leading-[1.5] text-fg-subtle">
            {layoutSummary}
          </span>
        </div>
      </div>

      <div class="px-[22px] py-[16px] border-t border-border-subtle flex flex-col gap-[9px]">
        <button
          type="button"
          onClick={onCopy}
          disabled={disabled}
          class={[
            'w-full flex items-center justify-center gap-2 px-4 py-[11px] rounded-[8px] text-[13px] font-semibold leading-none text-accent-fg cursor-pointer transition-colors',
            copied
              ? 'bg-[#3f7a52]'
              : disabled
                ? 'bg-accent-muted cursor-not-allowed'
                : 'bg-accent hover:bg-accent-hover',
          ].join(' ')}
          style="box-shadow: 0 1px 2px rgba(79,91,107,.35);"
        >
          {copied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 8.5 6.5 12 13 4" />
              </svg>
              Copied to clipboard
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <rect x="5.5" y="2.5" width="8" height="10" rx="1.5" />
                <path d="M10.5 2.5V1.6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1V11" stroke-linecap="round" />
              </svg>
              {busy ? 'Generating…' : 'Copy to clipboard'}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onDownload}
          disabled={disabled}
          class={[
            'w-full px-4 py-[10px] rounded-[8px] border border-border bg-surface-0 text-[12.5px] font-medium leading-none text-fg-muted cursor-pointer transition-colors',
            disabled
              ? 'opacity-60 cursor-not-allowed'
              : 'hover:bg-surface-2 hover:text-fg',
          ].join(' ')}
        >
          {busy ? 'Generating…' : 'Download PNG'}
        </button>
      </div>
    </aside>
  )
}

type SwatchProps = { label: string; active: boolean; onClick: () => void }

function LayoutSwatch({
  label,
  active,
  onClick,
  preview,
}: SwatchProps & { preview: Child }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active ? 'true' : 'false'}
      class={[
        'flex-1 flex flex-col items-center gap-2 px-2 py-3 rounded-[8px] cursor-pointer transition-colors box-border',
        active
          ? 'border-[1.5px] border-accent bg-[rgba(79,91,107,.05)] shadow-[0_0_0_3px_rgba(79,91,107,.08)]'
          : 'border border-border',
      ].join(' ')}
    >
      {preview}
      <span
        class={[
          'text-[11px] font-semibold leading-none',
          active ? 'text-fg' : 'text-fg-subtle',
        ].join(' ')}
      >
        {label}
      </span>
    </button>
  )
}

function StackedPreview({ active }: { active: boolean }) {
  const primary = active ? '#4f5b6b' : '#c2c5cc'
  const secondary = active ? '#8b93a1' : '#d8dae0'
  return (
    <span class="flex flex-col gap-[3px]" aria-hidden="true">
      <span class="w-[34px] h-[6px] rounded-[2px]" style={`background:${primary};`} />
      <span class="w-[34px] h-[6px] rounded-[2px]" style={`background:${secondary};`} />
      <span class="w-[34px] h-[6px] rounded-[2px]" style={`background:${secondary};`} />
    </span>
  )
}

function GridPreview({ active }: { active: boolean }) {
  const color = active ? '#8b93a1' : '#c2c5cc'
  return (
    <span class="grid grid-cols-2 gap-[3px]" aria-hidden="true">
      <span class="w-[16px] h-[9px] rounded-[2px]" style={`background:${color};`} />
      <span class="w-[16px] h-[9px] rounded-[2px]" style={`background:${color};`} />
      <span class="w-[16px] h-[9px] rounded-[2px]" style={`background:${color};`} />
      <span class="w-[16px] h-[9px] rounded-[2px]" style={`background:${color};`} />
    </span>
  )
}

function BgSwatch({ label, active, onClick }: SwatchProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active ? 'true' : 'false'}
      class={[
        'flex-1 text-center px-2 py-2 rounded-[7px] cursor-pointer transition-colors box-border',
        active
          ? 'border-[1.5px] border-accent bg-[rgba(79,91,107,.05)] text-fg font-semibold text-[12px]'
          : 'border border-border text-fg-subtle font-medium text-[12px]',
      ].join(' ')}
    >
      {label}
    </button>
  )
}
