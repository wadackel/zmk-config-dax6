export type EncoderDialProps = {
  /** Encoder ordinal (0 = left, 1 = right). Shown as `ENC N` in the cap. */
  encoderIdx: number
  /** Optional label displayed under `ENC N` (e.g. the CCW keycode). */
  label?: string
  /** Optional layer number rendered beneath the label. */
  layerIdx?: number
  /** Show the rotating dashed ring animation? Default true. */
  animate?: boolean
}

/**
 * Purely presentational rotary dial illustration used on the Sensors tab.
 * Composed of stacked absolute-positioned divs to render the radial
 * gradient body, a dashed tick ring that slowly spins to convey "encoder
 * rotates", and an inner cap with the encoder label. No interactive
 * affordance; the surrounding CCW/CW cards handle binding editing.
 */
export function EncoderDial({
  encoderIdx,
  label = '',
  layerIdx,
  animate = true,
}: EncoderDialProps) {
  return (
    <div class="relative w-[190px] h-[190px]">
      <div
        class="absolute inset-0 rounded-full border border-[rgba(22,24,29,.12)] shadow-[0_8px_26px_rgb(22_24_29/0.13),inset_0_1px_0_#fff]"
        style="background: radial-gradient(circle at 50% 42%, #ffffff, #eef0f4);"
      />
      <div
        class={[
          'absolute inset-[16px] rounded-full border-2 border-dashed border-[rgba(22,24,29,.14)]',
          animate ? 'animate-[kbd-spin-cw_11s_linear_infinite]' : '',
        ].join(' ')}
      />
      <div class="absolute inset-[44px] rounded-full bg-[#16181d] flex flex-col items-center justify-center gap-[3px] shadow-[inset_0_-3px_8px_rgba(0,0,0,.35)]">
        <span class="text-[9px] font-mono font-semibold tracking-[.12em] text-white/50 leading-none">
          ENC {encoderIdx}
        </span>
        {label && (
          <span class="text-[13px] font-semibold text-white leading-none">{label}</span>
        )}
        {layerIdx !== undefined && (
          <span class="text-[9px] font-mono text-white/40 leading-none">layer {layerIdx}</span>
        )}
      </div>
    </div>
  )
}
