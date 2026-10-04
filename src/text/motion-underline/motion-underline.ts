import { html, css, svg, nothing } from 'lit'
import { property } from 'lit/decorators.js'
import { customElement } from '../../utils/define.js'
import { MarkElement } from '../utils/mark.js'
import type { MotionUnderlineProps, UnderlineShape } from './motion-underline.types.js'

export type { MotionUnderlineProps, UnderlineShape, MarkTrigger } from './motion-underline.types.js'

/**
 * A line that draws itself under a phrase, from left to right. Straight,
 * dashed and dotted lines follow text that wraps across lines;
 * `shape="wave"` draws a wavy line and keeps the text on one line. It uses
 * the text color unless you set one.
 *
 * **Use it for:** a word or link that should stand out with a drawn line,
 * such as a call to action or a term you introduce.
 *
 * **Avoid it for:** ordinary links in body text, where the browser's own
 * underline is clearer and always visible. For a highlight behind the text,
 * use `motion-marker`.
 *
 * **Accessibility:** the line is a background under the text, which stays
 * in the page and is read by screen readers unchanged. With `trigger="hover"`
 * the line follows the pointer only, so give links their own visible focus
 * style.
 *
 * **Reduced motion:** the line appears fully drawn at once. With
 * `trigger="hover"` it appears on enter and disappears on leave, instantly.
 *
 * **Common mistakes:** leaving the link's own `text-decoration` on, so two
 * lines show; set `text-decoration: none` on the link. Using `shape="wave"`
 * on a long phrase, which stays on one line and can overflow a narrow screen.
 *
 * @element motion-underline
 *
 * @fires motion-start - When a run starts.
 * @fires motion-finish - When a run finishes, or `finish()` jumps to the end.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
 *
 * @slot - The phrase to underline. It may wrap across lines.
 *
 * @cssprop --mc-mark-color - Color of the line. Default `currentColor`.
 * @cssprop --mc-mark-thickness - Thickness of the line. Default `2px`.
 *
 * @example
 * ```html
 * <a href="/guide/"><motion-underline trigger="hover">Read the guide</motion-underline></a>
 * ```
 */
@customElement('motion-underline')
export class MotionUnderline extends MarkElement implements MotionUnderlineProps {
  /** `'line'`, `'dashed'` or `'dotted'`, which follow wrapping text, or `'wave'`, a wavy line that keeps the text on one line. */
  @property({ type: String, reflect: true }) shape: UnderlineShape = 'line'

  static styles = css`
    :host {
      --mark: var(--mc-mark-color, currentColor);
      display: inline;
      padding-bottom: 0.08em;
      background-image: linear-gradient(var(--mark), var(--mark));
      background-repeat: no-repeat;
      background-position: 0 100%;
      background-size: calc(min(var(--mc-mark-progress, 0), 1) * 100%) var(--mc-mark-thickness, 2px);
      -webkit-box-decoration-break: clone;
      box-decoration-break: clone;
    }
    :host([shape='dashed']) {
      background-image: repeating-linear-gradient(
        90deg,
        var(--mark) 0 0.35em,
        transparent 0 0.55em
      );
    }
    :host([shape='dotted']) {
      --dot: var(--mc-mark-thickness, 2px);
      background-image: repeating-linear-gradient(
        90deg,
        var(--mark) 0 var(--dot),
        transparent 0 calc(var(--dot) * 2.5)
      );
    }
    :host([shape='wave']) {
      --progress: min(var(--mc-mark-progress, 0), 1);
      display: inline-block;
      position: relative;
      white-space: nowrap;
      padding-bottom: 0;
      background: none;
    }
    svg {
      position: absolute;
      left: 0;
      overflow: visible;
      pointer-events: none;
    }
    path {
      fill: none;
      stroke: var(--mark);
      stroke-width: var(--mc-mark-thickness, 2px);
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: var(--progress) calc(1 - var(--progress));
      stroke-opacity: clamp(0, calc(var(--progress) * 50), 1);
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
    if (changed.has('shape')) this.layout()
  }

  private layout() {
    const box = this.renderRoot.querySelector<SVGSVGElement>('svg')
    const path = box?.querySelector('path')
    const w = this.offsetWidth
    if (!box || !path || !w) return
    const size = parseFloat(getComputedStyle(this).fontSize)
    const amp = size * 0.08
    const halves = Math.max(2, Math.round(w / (size * 0.4)))
    const step = w / halves
    let d = `M0 ${amp} Q${step / 2} ${-amp} ${step} ${amp}`
    for (let i = 2; i <= halves; i++) d += ` T${step * i} ${amp}`
    path.setAttribute('d', d)
    box.setAttribute('width', String(w))
    box.setAttribute('height', String(amp * 2))
    box.style.top = `${(this.offsetHeight + size) / 2 + size * 0.06}px`
  }

  render() {
    return html`<slot></slot>${this.shape === 'wave'
        ? html`<svg aria-hidden="true">${svg`<path pathLength="1"></path>`}</svg>`
        : nothing}`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-underline': MotionUnderline
  }
}
