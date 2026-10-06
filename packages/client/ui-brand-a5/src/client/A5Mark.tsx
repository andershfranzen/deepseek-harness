import { A5_MARK_PATH, A5_MARK_VIEWBOX } from './mark-path.ts'

/** Presentation requested by the sidebar and conversation hero mark slots. */
export interface A5MarkProps {
  /** Rendered width in pixels; height follows the mark's aspect ratio. */
  size: number
  /** Host class preserving the surrounding mark geometry. */
  className?: string | undefined
}

/**
 * Render the a5 mark in the current text color.
 * @param props - Host-supplied mark presentation.
 * @returns the decorative a5 svg (aria-hidden; the host surface carries the accessible name).
 */
export function A5Mark({ size, className }: A5MarkProps) {
  return (
    <svg
      className={className}
      width={size}
      height={(size * A5_MARK_VIEWBOX.height) / A5_MARK_VIEWBOX.width}
      viewBox={`0 0 ${A5_MARK_VIEWBOX.width} ${A5_MARK_VIEWBOX.height}`}
      fill="none"
      aria-hidden="true"
    >
      <path d={A5_MARK_PATH} fill="currentColor" />
    </svg>
  )
}
