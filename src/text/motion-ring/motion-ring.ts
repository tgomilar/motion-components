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
 * text stays in the page, selectable, and read unchanged. The ring sits
 * outside the text and takes no space, so it can overlap the lines above and
 * below in a tight paragraph.
 *
 * **Reduced motion:** the ring appears fully drawn at once on the same
 * trigger, with no animation.
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
 * @cssprop --mc-mark-color - Color of the stroke. Default `var(--color-accent, #2563eb)`.
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
      --progress: min(var(--mc-mark-progress, 0), 1);
      display: inline-block;
      position: relative;
      white-space: nowrap;
    }
    svg {
      position: absolute;
      overflow: visible;
      pointer-events: none;
    }
    .stroke {
      fill: none;
      stroke: var(--mc-mark-color, var(--color-accent, #2563eb));
      stroke-width: var(--mc-mark-thickness, 2px);
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: var(--progress) calc(1 - var(--progress));
      stroke-opacity: clamp(0, calc(var(--progress) * 50), 1);
    }
    ellipse.stroke {
      stroke-dashoffset: -0.58;
    }
  `

  private observer: ResizeObserver | null = null

  connectedCallback() {
    super.connectedCallback()
    this.observer = new ResizeObserver(() => this.layout())
    this.observer.observe(this)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.observer?.disconnect()
    this.observer = null
  }

  updated(changed: Map<string, unknown>) {
    super.updated(changed)
    if (changed.has('shape') || changed.has('padding')) this.layout()
  }

  private layout() {
    const box = this.renderRoot.querySelector<SVGSVGElement>('svg')
    const stroke = box?.querySelector('.stroke')
    if (!box || !stroke) return
    const w = this.offsetWidth
    const h = this.offsetHeight
    const pad = this.padding
    let width: number
    let height: number
    if (this.shape === 'box') {
      width = w + pad * 2
      height = h + pad * 2
      Object.entries({ width, height, rx: Math.min(6, height / 4) }).forEach(([k, v]) =>
        stroke.setAttribute(k, String(v)),
      )
    } else {
      const rx = w / 2 + pad + h * 0.12
      const ry = (h / 2) * 0.9 + pad
      width = rx * 2
      height = ry * 2
      Object.entries({ cx: rx, cy: ry, rx, ry }).forEach(([k, v]) =>
        stroke.setAttribute(k, String(v)),
      )
    }
    box.setAttribute('width', String(width))
    box.setAttribute('height', String(height))
    box.style.left = `${(w - width) / 2}px`
    box.style.top = `${(h - height) / 2}px`
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
