import { html, css, svg, nothing } from 'lit'
import { property } from 'lit/decorators.js'
import { customElement } from '../../utils/define.js'
import { MarkElement } from '../utils/mark.js'
import { wavePath } from '../utils/wave-path.js'
import type { MotionUnderlineProps, UnderlineShape } from './motion-underline.types.js'

export type { MotionUnderlineProps, UnderlineShape, MarkTrigger } from './motion-underline.types.js'

/**
 * A line that draws itself under a phrase, from left to right. Straight,
 * dashed and dotted lines follow text that wraps across lines;
 * `shape="wave"` and `shape="zigzag"` draw a wavy or a zigzag line and keep
 * the text on one line. It uses the text color unless you set one.
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
 * With `loop` it stays drawn and never cycles.
 *
 * **Common mistakes:** leaving the link's own `text-decoration` on, so two
 * lines show; set `text-decoration: none` on the link. Using `shape="wave"`
 * or `shape="zigzag"` on a long phrase, which stays on one line and can
 * overflow a narrow screen.
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
  /** `'line'`, `'dashed'` or `'dotted'`, which follow wrapping text, or `'wave'` or `'zigzag'`, which keep the text on one line. */
  @property({ type: String, reflect: true }) shape: UnderlineShape = 'line'

  static styles = css`
    :host {
      --mc-_mark-ink: var(--mc-mark-color, currentColor);
      --mc-_mark-drawn: min(var(--mc-_mark-progress, 0), 1);
      --mc-_mark-from: clamp(0, var(--mc-_mark-tail, 0), 1);
      --mc-_mark-len: max(calc(var(--mc-_mark-drawn) - var(--mc-_mark-from)), 0);
      --mc-_mark-at: calc(var(--mc-_mark-from) / max(calc(1 - var(--mc-_mark-len)), 0.0001));
      display: inline;
      padding-bottom: 0.08em;
      background-image: linear-gradient(var(--mc-_mark-ink), var(--mc-_mark-ink));
      background-repeat: no-repeat;
      background-position: calc(var(--mc-_mark-at) * 100%) 100%;
      background-size: calc(var(--mc-_mark-len) * 100%) var(--mc-mark-thickness, 2px);
      -webkit-box-decoration-break: clone;
      box-decoration-break: clone;
    }
    :host([shape='dashed']) {
      background-image: repeating-linear-gradient(
        90deg,
        var(--mc-_mark-ink) 0 0.35em,
        transparent 0 0.55em
      );
    }
    :host([shape='dotted']) {
      --mc-_mark-dot: var(--mc-mark-thickness, 2px);
      background-image: repeating-linear-gradient(
        90deg,
        var(--mc-_mark-ink) 0 var(--mc-_mark-dot),
        transparent 0 calc(var(--mc-_mark-dot) * 2.5)
      );
    }
    :host([shape='wave']),
    :host([shape='zigzag']) {
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
      stroke: var(--mc-_mark-ink);
      stroke-width: var(--mc-mark-thickness, 2px);
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: var(--mc-_mark-len) 2;
      stroke-dashoffset: calc(-1 * var(--mc-_mark-from));
      stroke-opacity: clamp(0, calc(var(--mc-_mark-len) * 50), 1);
    }
  `

  protected layout() {
    const box = this.renderRoot.querySelector<SVGSVGElement>('svg')
    const path = box?.querySelector('path')
    const w = this.offsetWidth
    if (!box || !path || !w) return
    const size = parseFloat(getComputedStyle(this).fontSize)
    const amp = size * 0.08
    const zigzag = this.shape === 'zigzag'
    path.setAttribute('d', wavePath(0, w, amp, amp, size * (zigzag ? 0.25 : 0.4), zigzag))
    box.setAttribute('width', String(w))
    box.setAttribute('height', String(amp * 2))
    box.style.top = `${(this.offsetHeight + size) / 2 + size * 0.06}px`
  }

  render() {
    return html`<slot></slot>${this.shape === 'wave' || this.shape === 'zigzag'
        ? html`<svg aria-hidden="true">${svg`<path pathLength="1"></path>`}</svg>`
        : nothing}`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-underline': MotionUnderline
  }
}
