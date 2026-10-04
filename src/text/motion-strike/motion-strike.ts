import { html, css } from 'lit'
import { customElement } from '../../utils/define.js'
import { MarkElement } from '../utils/mark.js'
import type { MotionStrikeProps } from './motion-strike.types.js'

export type { MotionStrikeProps, MarkTrigger } from './motion-strike.types.js'

/**
 * A line that draws itself through a phrase, from left to right. Use it for
 * an old price, a removed step or a word you replace.
 *
 * **Use it for:** an old price, a removed step or a replaced word, often
 * followed by the new value marked with `motion-marker` and a `delay`.
 *
 * **Avoid it for:** text the reader still needs to read, because text with a
 * line through it is harder to read.
 *
 * **Accessibility:** the line alone does not tell screen readers that the
 * text is removed. Wrap the component in `<del>`, and the new value in
 * `<ins>`. Browsers then draw their own line through `<del>`, so set
 * `text-decoration: none` on it.
 *
 * **Reduced motion:** the line appears fully drawn at once on the same
 * trigger, with no animation.
 *
 * **Common mistakes:** a `<del>` around the component with its default
 * `text-decoration`, so two lines show.
 *
 * @element motion-strike
 *
 * @fires motion-start - When a run starts.
 * @fires motion-finish - When a run finishes, or `finish()` jumps to the end.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
 *
 * @slot - The phrase to strike through. It may wrap across lines.
 *
 * @cssprop --mc-mark-color - Color of the line. Default `currentColor`.
 * @cssprop --mc-mark-thickness - Thickness of the line. Default `2px`.
 *
 * @example
 * ```html
 * <del><motion-strike>€49</motion-strike></del> <ins>€29</ins>
 * ```
 */
@customElement('motion-strike')
export class MotionStrike extends MarkElement implements MotionStrikeProps {
  static styles = css`
    :host {
      --mark: var(--mc-mark-color, currentColor);
      display: inline;
      padding-bottom: 0.08em;
      background-image: linear-gradient(var(--mark), var(--mark));
      background-repeat: no-repeat;
      background-position: 0 58%;
      background-size: calc(min(var(--mc-mark-progress, 0), 1) * 100%) var(--mc-mark-thickness, 2px);
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
    'motion-strike': MotionStrike
  }
}
