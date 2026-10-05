import { html, css, svg, nothing } from 'lit'
import { property } from 'lit/decorators.js'
import { customElement } from '../../utils/define.js'
import { MarkElement } from '../utils/mark.js'
import { wavePath } from '../utils/wave-path.js'
import type { MarkerShape, MotionMarkerProps } from './motion-marker.types.js'

export type { MarkerShape, MotionMarkerProps, MarkTrigger } from './motion-marker.types.js'

/**
 * A highlighter stroke that sweeps behind a phrase from left to right. The
 * straight stroke follows text that wraps across lines; `shape="wave"` draws a
 * wavy stroke and keeps the text on one line. The text itself never changes.
 *
 * **Use it for:** a key phrase in a headline or paragraph that the reader
 * should notice, such as a benefit, a result or a number.
 *
 * **Avoid it for:** whole paragraphs, or more than one or two phrases per
 * screen, where the highlight loses its point. For a line under or through
 * text, use `motion-underline` or `motion-strike`.
 *
 * **Accessibility:** the highlight is a background behind the text. The text
 * stays in the page, selectable, and read by screen readers unchanged. If the
 * highlight carries meaning, wrap the component in `<mark>`. Keep the color
 * transparent so the text keeps its contrast.
 *
 * **Reduced motion:** the highlight appears fully drawn at once on the same
 * trigger, with no animation. With `loop` it stays drawn and never cycles.
 *
 * **Common mistakes:** an opaque `--mc-marker-color`, which lowers the text
 * contrast. Setting `display: block` on the component, which removes the
 * highlight that follows each line. Using `shape="wave"` on a long phrase,
 * which stays on one line and can overflow a narrow screen.
 *
 * @element motion-marker
 *
 * @fires motion-start - When a run starts.
 * @fires motion-finish - When a run finishes, or `finish()` jumps to the end.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
 *
 * @slot - The phrase to highlight. It may wrap across lines, except with `shape="wave"`.
 *
 * @cssprop --mc-marker-color - Color of the highlighter stroke. Default `rgb(250 204 21 / 0.4)`.
 *
 * @example
 * ```html
 * <p>Ship motion that feels <motion-marker>physical</motion-marker>.</p>
 * <p>Makes <motion-marker loop hold="2">the code</motion-marker> feel alive.</p>
 * ```
 */
@customElement('motion-marker')
export class MotionMarker extends MarkElement implements MotionMarkerProps {
  /** `'line'`, a straight stroke that follows wrapping text, or `'wave'`, a wavy stroke that keeps the text on one line. */
  @property({ type: String, reflect: true }) shape: MarkerShape = 'line'

  static styles = css`
    :host {
      --mc-_mark-ink: var(--mc-marker-color, rgb(250 204 21 / 0.4));
      display: inline;
      padding: 0 0.15em;
      margin: 0 -0.15em;
      border-radius: 0.2em;
      background-image: linear-gradient(var(--mc-_mark-ink), var(--mc-_mark-ink));
      background-repeat: no-repeat;
      background-position: 0 85%;
      background-size: calc(min(var(--mc-_mark-progress, 0), 1) * 100%) 75%;
      -webkit-box-decoration-break: clone;
      box-decoration-break: clone;
    }
    :host([shape='wave']) {
      --mc-_mark-drawn: min(var(--mc-_mark-progress, 0), 1);
      display: inline-block;
      position: relative;
      isolation: isolate;
      white-space: nowrap;
      background: none;
    }
    svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: -1;
      overflow: visible;
      pointer-events: none;
    }
    path {
      fill: none;
      stroke: var(--mc-_mark-ink);
      stroke-width: 0.8em;
      stroke-linecap: round;
      stroke-dasharray: var(--mc-_mark-drawn) calc(1 - var(--mc-_mark-drawn));
      stroke-opacity: clamp(0, calc(var(--mc-_mark-drawn) * 50), 1);
    }
  `

  protected layout() {
    const path = this.renderRoot.querySelector('path')
    const w = this.offsetWidth
    if (!path || !w) return
    const size = parseFloat(getComputedStyle(this).fontSize)
    const r = size * 0.4
    path.setAttribute(
      'd',
      wavePath(r, w - r * 2, this.offsetHeight / 2 + size * 0.1, size * 0.07, size * 0.6),
    )
  }

  render() {
    return html`<slot></slot>${this.shape === 'wave'
        ? html`<svg aria-hidden="true">${svg`<path pathLength="1"></path>`}</svg>`
        : nothing}`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-marker': MotionMarker
  }
}
