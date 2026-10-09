import { html, css, svg } from 'lit'
import { property } from 'lit/decorators.js'
import { customElement } from '../../utils/define.js'
import { MarkElement } from '../utils/mark.js'
import type { MotionRingProps, RingShape } from './motion-ring.types.js'

export type { MotionRingProps, RingShape, MarkTrigger } from './motion-ring.types.js'

/**
 * An ellipse or a box that draws itself around a word or a short phrase, like
 * a pen circling something important. It keeps its text on one line.
 *
 * **Use it for:** one word or a short phrase to circle or box, such as a key
 * result, a price or a label.
 *
 * **Avoid it for:** long phrases, because the ring keeps its text on one line
 * and can overflow a narrow screen. Use `motion-marker` or `motion-underline`
 * for text that wraps.
 *
 * **Accessibility:** the drawing is an SVG hidden from screen readers. The
 * text stays in the page, selectable, and read unchanged. The ring takes room
 * on its left and right, so it never covers the neighbouring words. It takes
 * no room above and below, so it can overlap the lines above and below in a
 * tight paragraph.
 *
 * **Reduced motion:** the ring appears fully drawn at once on the same
 * trigger, with no animation. With `loop` it stays drawn and never cycles.
 *
 * **Common mistakes:** a large `padding` in a paragraph with a small line
 * height, which makes the ring cover the neighbouring lines; raise the line
 * height or lower `padding`.
 *
 * @element motion-ring
 *
 * @fires motion-start - When a run starts.
 * @fires motion-finish - When a run finishes, or `finish()` jumps to the end.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
 *
 * @slot - The word or short phrase to circle. It stays on one line.
 *
 * @cssprop --mc-mark-color - Color of the stroke. Default `var(--mc-color-accent, #2563eb)`.
 * @cssprop --mc-mark-thickness - Thickness of the stroke. Default `2px`.
 *
 * @example
 * ```html
 * <p>Every change is <motion-ring>reversible</motion-ring>.</p>
 * ```
 */
@customElement('motion-ring')
export class MotionRing extends MarkElement implements MotionRingProps {
  /** `'ellipse'`, or `'box'` for a rectangle with slightly rounded corners. */
  @property({ type: String, reflect: true }) shape: RingShape = 'ellipse'
  /** Gap in pixels between the text and the stroke. */
  @property({ type: Number }) padding = 6

  static styles = css`
    :host {
      --mc-_mark-drawn: min(var(--mc-_mark-progress, 0), 1);
      --mc-_mark-from: clamp(0, var(--mc-_mark-tail, 0), 1);
      --mc-_mark-len: max(calc(var(--mc-_mark-drawn) - var(--mc-_mark-from)), 0);
      --mc-_ring-start: 0;
      display: inline-block;
      position: relative;
      white-space: nowrap;
      margin-inline: calc(var(--mc-_ring-space, 0px) + var(--mc-mark-thickness, 2px) / 2);
    }
    svg {
      position: absolute;
      overflow: visible;
      pointer-events: none;
    }
    .stroke {
      fill: none;
      stroke: var(--mc-mark-color, var(--mc-color-accent, #2563eb));
      stroke-width: var(--mc-mark-thickness, 2px);
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: var(--mc-_mark-len) calc(1 - var(--mc-_mark-len));
      stroke-dashoffset: calc(-1 * (var(--mc-_ring-start) + var(--mc-_mark-from)));
      stroke-opacity: clamp(0, calc(var(--mc-_mark-len) * 50), 1);
    }
    ellipse.stroke {
      --mc-_ring-start: 0.58;
    }
  `

  protected layout() {
    const box = this.renderRoot.querySelector<SVGSVGElement>('svg')
    const stroke = box?.querySelector('.stroke')
    const range = document.createRange()
    range.selectNodeContents(this)
    const text = range.getBoundingClientRect()
    const host = this.getBoundingClientRect()
    if (!box || !stroke || !text.width || !host.width) return
    const scale = Math.abs(host.width - this.offsetWidth) > 1 ? this.offsetWidth / host.width : 1
    const pad = this.padding
    const h = text.height * scale
    const padX = this.shape === 'box' ? pad : pad + h * 0.1
    const width = text.width * scale + padX * 2
    const height = h + pad * 2
    const geometry =
      this.shape === 'box'
        ? { width, height, rx: Math.min(6, height / 4) }
        : { cx: width / 2, cy: height / 2, rx: width / 2, ry: height / 2 }
    Object.entries(geometry).forEach(([k, v]) => stroke.setAttribute(k, String(v)))
    box.setAttribute('width', String(width))
    box.setAttribute('height', String(height))
    box.style.left = `${(text.left - host.left) * scale - padX}px`
    box.style.top = `${(text.top - host.top) * scale - pad}px`
    this.style.setProperty('--mc-_ring-space', `${padX}px`)
  }

  render() {
    return html`<slot></slot
      ><svg aria-hidden="true">
        ${this.shape === 'box'
          ? svg`<rect class="stroke" pathLength="1"></rect>`
          : svg`<ellipse class="stroke" pathLength="1"></ellipse>`}
      </svg>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-ring': MotionRing
  }
}
