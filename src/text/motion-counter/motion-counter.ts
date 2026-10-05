import { LitElement, html, css } from 'lit'
import { property, state } from 'lit/decorators.js'
import { animate } from 'motion'
import { Controllable, PlaybackController, controlsRun } from '../../utils/playback.js'
import type { PlaybackRun } from '../../utils/playback.js'
import { LoopCycle, LoopTrigger, pauseOnHover } from '../utils/loop.js'
import type { LoopProps } from '../utils/loop.js'
import type { MotionCounterProps } from './motion-counter.types.js'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'

export type { MotionCounterProps } from './motion-counter.types.js'

/**
 * Animated number counter. Springs from `from` to `to` once the element
 * scrolls into view. Use `prefix`/`suffix` for currency or units, `decimals`
 * for fractional precision.
 *
 * **Use it for:** key figures and statistics, such as a year, a percentage or
 * a price, that count up once when they scroll into view.
 *
 * **Avoid it for:** values that change while the page is open. Setting a new
 * `to` does not update the number that is shown, and `replay()` counts again
 * from `from`.
 *
 * **Accessibility:** the number is plain text with no `aria-live`. Screen
 * readers read the value shown at that moment, which can be `from` or a value
 * in between. If the final value matters, also state it in nearby text.
 *
 * **Reduced motion:** the number shows `to` at once when the element scrolls
 * into view, with no counting. Before that, it shows `from`.
 *
 * **Common mistakes:** expecting thousands separators. The number is formatted
 * with `toFixed` only, so `10000` shows as "10000", not "10,000". Setting
 * `decimals` lower than the decimals in `to` rounds the final value, so
 * `to="4.87"` with `decimals="0"` ends at "5".
 *
 * @element motion-counter
 *
 * @fires motion-start - When a run starts.
 * @fires motion-finish - When a run finishes, or `finish()` jumps to the end.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
 *
 * @example
 * ```html
 * <motion-counter from="0" to="2024" duration="2"></motion-counter>
 * <motion-counter to="99" suffix="%" decimals="0"></motion-counter>
 * ```
 */
@customElement('motion-counter')
export class MotionCounter
  extends Controllable(LitElement)
  implements MotionCounterProps, LoopProps
{
  /** Starting value of the counter. */
  @property({ type: Number }) from = 0
  /** Target value to count up (or down) to. */
  @property({ type: Number }) to = 100
  /** Spring duration of the count animation, in seconds. */
  @property({ type: Number }) duration = 1.5
  /** Number of decimal places to render. */
  @property({ type: Number }) decimals = 0
  /** Text rendered before the number (e.g. `"$"`). */
  @property({ type: String }) prefix = ''
  /** Text rendered after the number (e.g. `"%"`). */
  @property({ type: String }) suffix = ''
  /** When `true`, only count the first time the element enters view. Set `once="false"` to turn it off. Ignored with `loop`. */
  @property({ type: Boolean, converter: flag }) once = true
  /** Count to `to`, hold, snap back to `from`, wait, then count again on repeat. */
  @property({ type: Boolean, converter: flag }) loop = false
  /** With `loop`, seconds the counter stays at `to` before it snaps back to `from`. */
  @property({ type: Number }) hold = 1.6
  /** With `loop`, seconds the counter stays at `from` before it counts again. */
  @property({ type: Number }) gap = 0.5
  /** Pause the loop while the pointer is over the counter. */
  @property({ type: Boolean, converter: flag, attribute: 'pause-on-hover' }) pauseOnHover = false

  @state() private value = 0

  static styles = css`
    :host {
      display: inline;
      font-variant-numeric: tabular-nums;
    }
  `

  playback: PlaybackController = new PlaybackController(this, {
    start: () => (this.loop ? { handle: this.cycle.start() } : this.count()),
    applyFinalState: () => {
      this.cycle.stop()
      this.value = this.to
    },
    applyInitialState: () => {
      this.cycle.stop()
      this.value = this.from
    },
  })

  private cycle: LoopCycle = new LoopCycle({
    leg: (out) => {
      if (out) {
        this.value = this.from
        return null
      }
      return this.count()
    },
    hold: () => this.hold,
    gap: () => this.gap,
  })

  private viewport = new LoopTrigger(this, {
    threshold: () => 0.2,
    once: () => this.once,
    loop: () => this.loop,
  })

  private detachPauseOnHover: (() => void) | null = null

  private count(): PlaybackRun {
    const counter = { value: this.from }
    return controlsRun(
      animate(
        counter,
        { value: this.to },
        {
          duration: this.duration,
          type: 'spring',
          bounce: 0.05,
          onUpdate: () => {
            this.value = counter.value
          },
          onComplete: () => {
            this.value = this.to
          },
        },
      ),
    )
  }

  connectedCallback() {
    super.connectedCallback()
    this.value = this.from
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

  /** Resets the counter to `from` and re-runs the count animation. */
  replay() {
    this.viewport.reset()
    this.cancel()
    void this.play()
  }

  render() {
    const formatted = this.value.toFixed(this.decimals)
    return html`${this.prefix}${formatted}${this.suffix}`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-counter': MotionCounter
  }
}
