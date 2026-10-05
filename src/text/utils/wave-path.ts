/**
 * SVG path data for a wavy or zigzag line from `x` to `x + width`. It swings
 * `amp` pixels above and below `mid`, with about `half` pixels per half wave.
 */
export function wavePath(
  x: number,
  width: number,
  mid: number,
  amp: number,
  half: number,
  zigzag = false,
): string {
  const halves = zigzag
    ? Math.max(2, Math.round(width / (half * 2)) * 2)
    : Math.max(2, Math.round(width / half))
  const step = width / halves
  let d = zigzag
    ? `M${x} ${mid + amp}`
    : `M${x} ${mid} Q${x + step / 2} ${mid - amp * 2} ${x + step} ${mid}`
  for (let i = zigzag ? 1 : 2; i <= halves; i++)
    d += zigzag ? ` L${x + step * i} ${i % 2 ? mid - amp : mid + amp}` : ` T${x + step * i} ${mid}`
  return d
}
