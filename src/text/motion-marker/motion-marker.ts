import { html, css } from 'lit'
import { customElement } from '../../utils/define.js'
import { MarkElement } from '../utils/mark.js'
import type { MotionMarkerProps } from './motion-marker.types.js'

export type { MotionMarkerProps, MarkTrigger } from './motion-marker.types.js'

/**
 * A highlighter stroke that sweeps behind a phrase from left to right. It
 * follows text that wraps across lines, and the text itself never changes.
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
 * trigger, with no animation.
 *
 * **Common mistakes:** an opaque `--mc-marker-color`, which lowers the text
 * contrast. Setting `display: block` on the component, which removes the
 * highlight that follows each line.
 *
 * @element motion-marker
 *
 * @fires motion-start - When a run starts.
 * @fires motion-finish - When a run finishes, or `finish()` jumps to the end.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
 *
 * @slot - The phrase to highlight. It may wrap across lines.
 *
 * @cssprop --mc-marker-color - Color of the highlighter stroke. Default `rgb(250 204 21 / 0.4)`.
 *
 * @example
 * ```html
 * <p>Ship motion that feels <motion-marker>physical</motion-marker>.</p>
 * ```
 */
@customElement('motion-marker')
export class MotionMarker extends MarkElement implements MotionMarkerProps {
  static styles = css`
    :host {
      --mark: var(--mc-marker-color, rgb(250 204 21 / 0.4));
      display: inline;
      padding: 0 0.15em;
      margin: 0 -0.15em;
      border-radius: 0.2em;
      background-image: linear-gradient(var(--mark), var(--mark));
      background-repeat: no-repeat;
      background-position: 0 85%;
      background-size: calc(min(var(--mc-mark-progress, 0), 1) * 100%) 75%;
      -webkit-box-decoration-break: clone;
      box-decoration-break: clone;
    }
  `

  render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-marker': MotionMarker
  }
}
