/**
 * Inline 17×17 SVG glyphs for the icon rail. `stroke="currentColor"`
 * lets each rail item colour its icon by inheritance so the rail can
 * highlight the active tab without threading a fill/stroke prop.
 *
 * hono/jsx's built-in `IntrinsicElements` type does not include SVG
 * elements, so this file uses shared string constants for the base
 * attributes instead of a typed spread. Runtime output is unchanged
 * — hono/jsx forwards unknown attributes verbatim.
 */

type IconProps = { class?: string }
type IconArg = IconProps | undefined

const VB = '0 0 16 16'
const STROKE = 'currentColor'
const STROKE_WIDTH = '1.4'
const STROKE_CAP = 'round'
const STROKE_JOIN = 'round'
const SIZE = '17'

/** Layered pyramid — stacked keymap layers. */
export function LayersIcon(props: IconArg) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg"
      width={SIZE}
      height={SIZE}
      viewBox={VB}
      fill="none"
      stroke={STROKE}
      stroke-width={STROKE_WIDTH}
      stroke-linecap={STROKE_CAP}
      stroke-linejoin={STROKE_JOIN}
      aria-hidden="true"
      class={props?.class}
    >
      <path d="M8 2 2 5l6 3 6-3-6-3Z" />
      <path d="M2.4 8.2 8 11l5.6-2.8" />
      <path d="M2.4 11.2 8 14l5.6-2.8" />
    </svg>
  )
}

/** Two overlapping rounded squares — "combined" keys pressed together. */
export function CombosIcon(props: IconArg) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg"
      width={SIZE}
      height={SIZE}
      viewBox={VB}
      fill="none"
      stroke={STROKE}
      stroke-width={STROKE_WIDTH}
      stroke-linecap={STROKE_CAP}
      stroke-linejoin={STROKE_JOIN}
      aria-hidden="true"
      class={props?.class}
    >
      <rect x="2" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="7" y="5.5" width="7" height="7" rx="1.6" fill="var(--nav-icon-fill, transparent)" />
    </svg>
  )
}

/** Bulleted horizontal lines — a scripted sequence. */
export function MacrosIcon(props: IconArg) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg"
      width={SIZE}
      height={SIZE}
      viewBox={VB}
      fill="none"
      stroke={STROKE}
      stroke-width={STROKE_WIDTH}
      stroke-linecap={STROKE_CAP}
      stroke-linejoin={STROKE_JOIN}
      aria-hidden="true"
      class={props?.class}
    >
      <circle cx="3.4" cy="4" r="1" />
      <circle cx="3.4" cy="8" r="1" />
      <circle cx="3.4" cy="12" r="1" />
      <path d="M6.4 4h7M6.4 8h7M6.4 12h4.5" />
    </svg>
  )
}

/** Two circles pinned to horizontal rails — mod-tap / layer-tap hinge. */
export function BehaviorsIcon(props: IconArg) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg"
      width={SIZE}
      height={SIZE}
      viewBox={VB}
      fill="none"
      stroke={STROKE}
      stroke-width={STROKE_WIDTH}
      stroke-linecap={STROKE_CAP}
      stroke-linejoin={STROKE_JOIN}
      aria-hidden="true"
      class={props?.class}
    >
      <path d="M2.5 5h11M2.5 11h11" />
      <circle cx="6" cy="5" r="1.9" fill="var(--nav-icon-fill, transparent)" />
      <circle cx="10" cy="11" r="1.9" fill="var(--nav-icon-fill, transparent)" />
    </svg>
  )
}

/** Rotary dial with a knurled edge — matches the Sensors tab's rotary
 *  encoder domain better than the previous plain clock face. */
export function SensorsIcon(props: IconArg) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg"
      width={SIZE}
      height={SIZE}
      viewBox={VB}
      fill="none"
      stroke={STROKE}
      stroke-width={STROKE_WIDTH}
      stroke-linecap={STROKE_CAP}
      stroke-linejoin={STROKE_JOIN}
      aria-hidden="true"
      class={props?.class}
    >
      <circle cx="8" cy="8" r="5.6" />
      <circle cx="8" cy="8" r="1.8" fill="var(--nav-icon-fill, transparent)" />
      <path d="M8 1.9v1.4M8 12.7v1.4M14.1 8h-1.4M3.3 8H1.9M12.3 3.7l-1 1M4.7 11.3l-1 1M12.3 12.3l-1-1M4.7 4.7l-1-1" />
    </svg>
  )
}

/** Mouse silhouette — trackball / mouse gestures. */
export function MouseGesturesIcon(props: IconArg) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg"
      width={SIZE}
      height={SIZE}
      viewBox={VB}
      fill="none"
      stroke={STROKE}
      stroke-width={STROKE_WIDTH}
      stroke-linecap={STROKE_CAP}
      stroke-linejoin={STROKE_JOIN}
      aria-hidden="true"
      class={props?.class}
    >
      <rect x="4" y="2.2" width="8" height="11.6" rx="4" />
      <path d="M8 4.4v2.6" />
    </svg>
  )
}

/** Keyboard-frame with press marker — tester (typing target). */
export function TesterIcon(props: IconArg) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg"
      width={SIZE}
      height={SIZE}
      viewBox={VB}
      fill="none"
      stroke={STROKE}
      stroke-width={STROKE_WIDTH}
      stroke-linecap={STROKE_CAP}
      stroke-linejoin={STROKE_JOIN}
      aria-hidden="true"
      class={props?.class}
    >
      <rect x="1.8" y="4.4" width="12.4" height="7.2" rx="1.4" />
      <path d="M4.2 7.2h.02M6.6 7.2h.02M9 7.2h.02M11.4 7.2h.02M4.6 9.6h6.8" />
    </svg>
  )
}
