import { LitElement, html, css } from 'lit'
import { property, state } from 'lit/decorators.js'
import { Controllable, PlaybackController, frameLoop } from '../../utils/playback.js'
import type { PlaybackRun } from '../../utils/playback.js'
import { LoopCycle, LoopTrigger, delayedRun, pauseOnHover } from '../utils/loop.js'
import type { LoopProps } from '../utils/loop.js'
import type { MotionScrambleProps, ScrambleTrigger } from './motion-scramble.types.js'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'

export type { MotionScrambleProps, ScrambleTrigger } from './motion-scramble.types.js'

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&'

/**
 * Decode-style text scramble. Cycles each character through random glyphs,
 * locking them in left-to-right until the original text resolves.
 *
 * @element motion-scramble
 *
 * @slot - The text to scramble. Plain text only — read once on connect.
 *
 * @fires motion-start - When a run starts.
 * @fires motion-finish - When a run finishes, or `finish()` jumps to the end.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
 *
 * @example
 * ```html
 * <motion-scramble interval="0.035" iterations="3" trigger="hover">
 *   DECODE_ME
 * </motion-scramble>
 * ```
 */
@customElement('motion-scramble')
export class MotionScramble
  extends Controllable(LitElement)
  implements MotionScrambleProps, LoopProps
{
  /** Time between glyph swaps, in seconds. */
  @property({ type: Number }) interval = 0.04
  /** Delay before scrambling starts, in seconds. */
  @property({ type: Number }) delay = 0
  /** Number of random-glyph frames per character before locking in. */
  @property({ type: Number }) iterations = 2
  /** When `true`, only scramble the first time the element enters view. Set `once="false"` to turn it off. Ignored with `loop`. */
  @property({ type: Boolean, converter: flag }) once = true
  /** Scramble to the original text, hold, wait, then scramble again on repeat. */
  @property({ type: Boolean, converter: flag }) loop = false
  /** With `loop`, seconds the resolved text stays visible before it scrambles again. */
  @property({ type: Number }) hold = 1.6
  /** With `loop`, seconds between cycles, while the text is already resolved. */
  @property({ type: Number }) gap = 0.5
  /** Pause the loop while the pointer is over the text. */
  @property({ type: Boolean, converter: flag, attribute: 'pause-on-hover' }) pauseOnHover = false
  /** What starts the scramble: `'view'` (when scrolled into view) or `'hover'`. */
  @property({ type: String, reflect: true }) trigger: ScrambleTrigger = 'view'

  @state() private displayed = ''

  static styles = css`
    :host {
      display: inline;
      font-variant-numeric: tabular-nums;
    }
  `

  private full = ''
  private frame = 0
  private iter = 0
  private elapsed = 0
  private ticker = frameLoop((dt) => {
    this.elapsed += dt
    if (this.elapsed < this.interval * 1000) return
    this.elapsed = 0
    this.scramble()
  })
  private resolveSettled: (() => void) | null = null
  private detachPauseOnHover: (() => void) | null = null

  private cycle: LoopCycle = new LoopCycle({
    leg: (out) => (out ? null : this.scrambleRun()),
    hold: () => this.hold,
    gap: () => this.gap,
    delay: () => this.delay,
  })

  private viewport = new LoopTrigger(this, {
    threshold: () => 0.2,
    once: () => this.once,
    loop: () => this.loop,
  })

  playback: PlaybackController = new PlaybackController(this, {
    start: () =>
      this.loop
        ? { handle: this.cycle.start() }
        : delayedRun(
            () => this.delay,
            () => this.scrambleRun(),
          ),
    applyFinalState: () => {
      this.cycle.stop()
      this.displayed = this.full
    },
    applyInitialState: () => {
      this.cycle.stop()
      this.displayed = this.full
    },
  })

  private scrambleRun(): PlaybackRun {
    this.frame = 0
    this.iter = 0
    this.elapsed = 0
    const done = new Promise<void>((resolve) => {
      this.resolveSettled = resolve
    })
    this.ticker.start()
    return {
      handle: {
        pause: () => this.ticker.stop(),
        resume: () => this.ticker.start(),
        finish: () => this.settle(),
        cancel: () => {
          this.ticker.stop()
          this.resolveSettled = null
        },
      },
      done,
    }
  }

  connectedCallback() {
    // eslint-disable-next-line wc/no-child-traversal-in-connectedcallback
    this.full = this.textContent?.trim() ?? ''
    this.displayed = this.full
    this.textContent = ''
    super.connectedCallback()

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    if (this.trigger === 'hover') {
      this.addEventListener('pointerenter', this.begin)
    } else {
      this.viewport.arm()
    }

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
    this.removeEventListener('pointerenter', this.begin)
    this.detachPauseOnHover?.()
    this.detachPauseOnHover = null
  }

  private begin = () => {
    this.cancel()
    void this.play()
  }

  private settle() {
    this.ticker.stop()
    this.resolveSettled?.()
    this.resolveSettled = null
    this.displayed = this.full
  }

  private scramble() {
    const len = this.full.length
    const revealed = Math.floor(this.iter / this.iterations)

    this.displayed = this.full
      .split('')
      .map((char, i) => {
        if (char === ' ') return ' '
        if (i < revealed) return char
        if (this.frame % 3 === 0) return CHARS[Math.floor(Math.random() * CHARS.length)]
        return this.displayed[i] ?? char
      })
      .join('')

    this.frame++
    this.iter++

    if (revealed >= len) {
      this.settle()
    }
  }

  /** Re-runs the scramble animation. */
  replay() {
    this.viewport.reset()
    this.begin()
  }

  render() {
    return html`${this.displayed}`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-scramble': MotionScramble
  }
}
