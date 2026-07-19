import { renderKeymapPng, type RenderKeymapArgs } from './canvas'

export type ExportArgs = RenderKeymapArgs

/**
 * Writes a rendered PNG to the OS clipboard.
 *
 * The Blob is passed to `ClipboardItem` as the still-pending Promise from
 * `renderKeymapPng` rather than an `await`ed value: Safari and Firefox require
 * `clipboard.write` to be called synchronously from the user gesture, and any
 * `await` between the click handler and the write drops the transient user
 * activation, turning the write into a `NotAllowedError`.
 */
export async function copyKeymapToClipboard(args: ExportArgs): Promise<void> {
  const item = new ClipboardItem({ 'image/png': renderKeymapPng(args) })
  await navigator.clipboard.write([item])
}

export async function downloadKeymapPng(
  args: ExportArgs,
  filename: string,
): Promise<void> {
  const blob = await renderKeymapPng(args)
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } finally {
    URL.revokeObjectURL(url)
  }
}
