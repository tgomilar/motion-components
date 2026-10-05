import { LitElement, html, css } from 'lit'
import { property, query } from 'lit/decorators.js'
import { animate } from 'motion'
import { Controllable, PlaybackController, controlsRun } from '../../utils/playback.js'
import type { PlaybackRun } from '../../utils/playback.js'
import { LoopCycle, LoopTrigger, pauseOnHover } from '../utils/loop.js'
import type { LoopProps } from '../utils/loop.js'
import type { MotionTextMaskProps } from './motion-text-mask.types.js'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'

export type { MotionTextMaskProps } from './motion-text-mask.types.js'

/**
 * Mask-clip reveal primitive. Clips slotted content behind an `overflow:hidden`
 * boundary and slides it upward into view — the same pattern used inside
 * `motion-headline`, exposed as a composable wrapper.
 *
 * **Use it for:** a heading, a line or a word that should slide up from
 * behind an invisible edge when it scrolls into view.
 *
 * **Avoid it for:** content in the first screen that people need at once.
 * For a heading that splits into lines, words or letters by itself, use
 * `motion-headline` with `variant="slide"`.
 *
 * **Accessibility:** the content stays in the page while it is hidden, so
 * screen readers read it before it animates. Only transform changes, so the
 * layout does not shift. The host clips its content with `overflow: hidden`,
 * so a focus outline on a link inside can be cut off; give such links an
 * outline that stays inside, for example with a negative `outline-offset`.
 *
 * **Reduced motion:** the content shows in place at once, with no slide.
 *
 * **Common mistakes:** wrapping a whole paragraph in one mask: the host is
 * `inline-block`, so the paragraph slides up as one block, not line by line.
 * Use one mask per line, or `motion-headline` with `by="lines"`.
 *
 * @element motion-text-mask
 *
 * @fires motion-start - When a run starts.
 * @fires motion-finish - When a run finishes, or `finish()` jumps to the end.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
 *
 * @slot - The text or inline content to reveal under the mask.
 *
 * @example
 * ```html
 * <motion-text-mask duration="1.1">Your headline text</motion-text-mask>
 * ```
 */
@customElement('motion-text-mask')
export class MotionTextMask
  extends Controllable(LitElement)
  implements MotionTextMaskProps, LoopProps
{
  /** Spring duration of the slide-up reveal, in seconds. */
  @property({ type: Number }) duration = 0.9
  /** Delay before the reveal starts, in seconds. */
  @property({ type: Number }) delay = 0
  /** IntersectionObserver threshold (0–1) at which the reveal triggers. */
  @property({ type: Number }) threshold = 0.2
  /** When `true`, only animate the first time the element enters view. Set `once="false"` to turn it off. Ignored with `loop`. */
  @property({ type: Boolean, converter: flag }) once = true
  /** Slide the content in, hold, slide it back out, then repeat. */
  @property({ type: Boolean, converter: flag }) loop = false
  /** With `loop`, seconds the content stays visible before it slides back out. */
  @property({ type: Number }) hold = 1.6
  /** With `loop`, seconds the content stays hidden before it slides in again. */
  @property({ type: Number }) gap = 0.5
  /** Pause the loop while the pointer is over the mask. */
  @property({ type: Boolean, converter: flag, attribute: 'pause-on-hover' }) pauseOnHover = false

  static styles = css`
    :host {
      display: inline-block;
      overflow: hidden;
      vertical-align: bottom;
    }
    .inner {
      display: block;
      will-change: transform;
    }
  `

  @query('.inner') private inner!: HTMLElement

  private detachPauseOnHover: (() => void) | null = null

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  private cycle: LoopCycle = new LoopCycle({
    leg: (out) => this.slide(out, 0),
    hold: () => this.hold,
    gap: () => this.gap,
    delay: () => this.delay,
  })

  private viewport = new LoopTrigger(this, {
    threshold: () => this.threshold,
    once: () => this.once,
    loop: () => this.loop,
  })

  playback: PlaybackController = new PlaybackController(this, {
    start: () => (this.loop ? { handle: this.cycle.start() } : this.slide(false)),
    applyFinalState: () => {
      this.cycle.stop()
      this.inner.style.transform = ''
    },
    applyInitialState: () => {
      this.cycle.stop()
      this.inner.style.transform = 'translateY(110%)'
    },
  })

  private slide(out: boolean, startDelay = this.delay): PlaybackRun {
    return controlsRun(
      animate(this.inner, out ? { y: ['0%', '110%'] } : { y: ['110%', '0%'] }, {
        duration: this.duration,
        ...(out ? {} : { delay: startDelay }),
        type: 'spring',
        bounce: 0.05,
      }),
    )
  }

  connectedCallback() {
    super.connectedCallback()
  }

  firstUpdated() {
    if (!this.reduced) {
      this.inner.style.transform = 'translateY(110%)'
    }

    this.viewport.arm()
    this.detachPauseOnHover = pauseOnHover(
      this,
      () => this.loop && this.pauseOnHover,
      () => this.pause(),
      () => this.play(),
    )
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.viewport.disarm()
    this.detachPauseOnHover?.()
    this.detachPauseOnHover = null
  }

  /** Resets the inner mask offset and re-runs the reveal. */
  replay() {
    this.viewport.reset()
    this.cancel()
    void this.play()
  }

  render() {
    return html`<div class="inner"><slot></slot></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-text-mask': MotionTextMask
  }
}
