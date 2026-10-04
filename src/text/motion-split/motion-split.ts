import { LitElement, html, css } from 'lit'
import { property } from 'lit/decorators.js'
import { animate, stagger } from 'motion'
import { REVEAL_SPRING } from '../../utils/springs.js'
import { Controllable, PlaybackController, controlsRun } from '../../utils/playback.js'
import { splitText } from '../utils/split-text.js'
import { useIntersect } from '../utils/use-intersect.js'
import type { MotionSplitProps, SplitBy } from './motion-split.types.js'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'

export type { MotionSplitProps, SplitBy } from './motion-split.types.js'

/**
 * Split-text reveal primitive. Splits the slotted text into spans and
 * fades + translates each unit in with a stagger when the first unit
 * enters view.
 *
 * **Use it for:** headings and short paragraphs that should come in word by
 * word, letter by letter or line by line when they scroll into view.
 *
 * **Avoid it for:** text with links, emphasis or other markup, because the
 * content is replaced with plain spans. To reveal a block as one piece, use
 * `motion-reveal`. For units that slide up under a mask, use
 * `motion-headline`.
 *
 * **Accessibility:** the split spans get `aria-hidden`, and a visually hidden
 * span keeps the original text, so screen readers read the whole phrase and
 * not single letters. Only opacity and transform animate, so the layout does
 * not shift.
 *
 * **Reduced motion:** the text is still split, but every unit shows at once
 * in its final place, with no animation.
 *
 * **Common mistakes:** expecting `by="lines"` to follow the layout: lines are
 * measured once, on first render, and are not measured again when the width
 * changes. Replacing the text later: the new text is not split and does not
 * animate.
 *
 * @element motion-split
 *
 * @fires motion-start - When a run starts.
 * @fires motion-finish - When a run finishes, or `finish()` jumps to the end.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
 *
 * @slot - The text to split. Markup inside is replaced with span units.
 *
 * @example
 * ```html
 * <motion-split by="chars" interval="0.03" y="30">
 *   Each character animates in.
 * </motion-split>
 * ```
 */
// @preload host — raw text is visible until upgrade hides the split spans for the entrance animation
@customElement('motion-split')
export class MotionSplit extends Controllable(LitElement) implements MotionSplitProps {
  /** Split unit: `'words'`, `'chars'`, or `'lines'`. */
  @property({ type: String, reflect: true }) by: SplitBy = 'words'
  /** Stagger between units, in seconds. */
  @property({ type: Number }) interval = 0.05
  /** Spring duration of each unit's reveal, in seconds. */
  @property({ type: Number }) duration = 0.6
  /** Initial vertical offset in pixels for each unit. */
  @property({ type: Number }) y = 20
  /** When `true`, only animate the first time the element enters view. Set `once="false"` to turn it off. */
  @property({ type: Boolean, converter: flag }) once = true

  static styles = css`
    :host {
      display: block;
    }
    :host(:not([data-ready])) {
      visibility: hidden;
    }
  `

  private disconnectIntersect: (() => void) | null = null
  private animated = false
  private spans: HTMLElement[] = []

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  playback: PlaybackController = new PlaybackController(this, {
    start: () =>
      controlsRun(
        animate(
          this.spans,
          { opacity: [0, 1], y: [this.y, 0] },
          { delay: stagger(this.interval), ...REVEAL_SPRING, duration: this.duration },
        ),
      ),
    applyFinalState: () => {
      for (const s of this.spans) {
        s.style.opacity = '1'
        s.style.transform = ''
      }
    },
    applyInitialState: () => {
      for (const s of this.spans) {
        s.style.opacity = '0'
        s.style.transform = `translateY(${this.y}px)`
      }
    },
  })

  firstUpdated() {
    const { spans } = splitText(this, this.by)
    if (!spans.length) {
      this.setAttribute('data-ready', '')
      return
    }
    this.spans = spans

    this.setAttribute('data-ready', '')

    if (this.reduced) {
      this.finish()
      return
    }

    this.spans.forEach((s) => {
      s.style.opacity = '0'
      s.style.transform = `translateY(${this.y}px)`
    })

    this.disconnectIntersect = useIntersect(
      this.spans[0],
      0.1,
      () => {
        if (!this.animated && this.playState === 'idle') {
          void this.play()
          if (this.once) {
            this.animated = true
            this.disconnectIntersect?.()
          }
        }
      },
      () => {
        if (!this.once && this.playState !== 'idle') this.cancel()
      },
    )
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.disconnectIntersect?.()
  }

  /** Resets and re-runs the staggered reveal. */
  replay() {
    this.animated = false
    this.cancel()
    void this.play()
  }

  render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-split': MotionSplit
  }
}
