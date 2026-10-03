import { LitElement, html, css } from 'lit'
import { property, state } from 'lit/decorators.js'
import { Controllable, PlaybackController, frameLoop } from '../../utils/playback.js'
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
 * @example
 * ```html
 * <motion-scramble interval="0.035" iterations="3" trigger="hover">
 *   DECODE_ME
 * </motion-scramble>
 * ```
 */
@customElement('motion-scramble')
export class MotionScramble extends Controllable(LitElement) implements MotionScrambleProps {
  /** Time between glyph swaps, in seconds. */
  @property({ type: Number }) interval = 0.04
  /** Delay before scrambling starts, in seconds. */
  @property({ type: Number }) delay = 0
  /** Number of random-glyph frames per character before locking in. */
  @property({ type: Number }) iterations = 2
  /** When `true`, only scramble the first time the element enters view. Set `once="false"` to turn it off. */
  @property({ type: Boolean, converter: flag }) once = true
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
  private observer: IntersectionObserver | null = null
  private triggered = false
  private resolveSettled: (() => void) | null = null

  private loop = frameLoop((dt) => {
    this.elapsed += dt
    if (this.elapsed < this.interval * 1000) return
    this.elapsed = 0
    this.scramble()
  })

  playback: PlaybackController = new PlaybackController(this, {
    start: () => {
      this.frame = 0
      this.iter = 0
      this.elapsed = 0
      const done = new Promise<void>((resolve) => {
        this.resolveSettled = resolve
      })
      this.loop.start()
      return {
        handle: {
          pause: () => this.loop.stop(),
          resume: () => this.loop.start(),
          finish: () => this.settle(),
          cancel: () => {
            this.loop.stop()
            this.resolveSettled = null
          },
        },
        done,
      }
    },
    applyFinalState: () => {
      this.displayed = this.full
    },
    applyInitialState: () => {
      this.displayed = this.full
    },
  })

  connectedCallback() {
    // eslint-disable-next-line wc/no-child-traversal-in-connectedcallback
    this.full = this.textContent?.trim() ?? ''
    this.displayed = this.full
    this.textContent = ''
    super.connectedCallback()

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    if (this.trigger === 'hover') {
      this.addEventListener('mouseenter', this.begin)
    } else {
      this.observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !this.triggered) {
            if (this.delay) {
              setTimeout(() => this.begin(), this.delay * 1000)
            } else {
              this.begin()
            }
            if (this.once) {
              this.triggered = true
              this.observer?.disconnect()
            }
          }
        },
        { threshold: 0.2 },
      )
      this.observer.observe(this)
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.observer?.disconnect()
    this.removeEventListener('mouseenter', this.begin)
  }

  private begin = () => {
    this.cancel()
    void this.play()
  }

  private settle() {
    this.loop.stop()
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
    this.triggered = false
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
