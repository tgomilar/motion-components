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
 * trigger, with no animation. With `loop` it stays drawn and never cycles.
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
      --mc-_mark-ink: var(--mc-mark-color, currentColor);
      display: inline;
      position: relative;
      padding-bottom: 0.08em;
      -webkit-box-decoration-break: clone;
      box-decoration-break: clone;
    }
    .lines {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
    }
    .line {
      --mc-_mark-drawn: clamp(
        0,
        (var(--mc-_mark-progress, 0) - var(--mc-_line-from)) / var(--mc-_line-span),
        1
      );
      --mc-_mark-from: clamp(
        0,
        (var(--mc-_mark-tail, 0) - var(--mc-_line-from)) / var(--mc-_line-span),
        1
      );
      --mc-_mark-len: max(calc(var(--mc-_mark-drawn) - var(--mc-_mark-from)), 0);
      --mc-_mark-at: calc(var(--mc-_mark-from) / max(calc(1 - var(--mc-_mark-len)), 0.0001));
      position: absolute;
      background-image: linear-gradient(var(--mc-_mark-ink), var(--mc-_mark-ink));
      background-repeat: no-repeat;
      background-position: calc(var(--mc-_mark-at) * 100%) 58%;
      background-size: calc(var(--mc-_mark-len) * 100%) var(--mc-mark-thickness, 2px);
    }
  `

  private resizeParent: ResizeObserver | null = null

  connectedCallback() {
    super.connectedCallback()
    this.resizeParent = new ResizeObserver(() => this.layout())
    if (this.parentElement) this.resizeParent.observe(this.parentElement)
    void document.fonts?.ready.then(() => this.layout())
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.resizeParent?.disconnect()
    this.resizeParent = null
  }

  protected layout() {
    const lines = this.renderRoot.querySelector<HTMLElement>('.lines')
    if (!lines) return
    const origin = lines.getBoundingClientRect()
    const rects = [...this.getClientRects()].filter((r) => r.width > 0)
    const total = rects.reduce((sum, r) => sum + r.width, 0)
    let from = 0
    lines.replaceChildren(
      ...rects.map((r) => {
        const line = document.createElement('span')
        line.className = 'line'
        Object.assign(line.style, {
          left: `${r.left - origin.left}px`,
          top: `${r.top - origin.top}px`,
          width: `${r.width}px`,
          height: `${r.height}px`,
        })
        line.style.setProperty('--mc-_line-from', String(from / total))
        line.style.setProperty('--mc-_line-span', String(r.width / total))
        from += r.width
        return line
      }),
    )
  }

  render() {
    return html`<slot></slot><span class="lines" aria-hidden="true"></span>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-strike': MotionStrike
  }
}
