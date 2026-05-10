import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type { MotionScrambleProps } from './motion-scramble.types.js'

export type { MotionScrambleProps } from './motion-scramble.types.js'

const sheet = new CSSStyleSheet()
sheet.replaceSync('motion-scramble:not(:defined) { opacity: 0 !important; }')
document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]

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
 * <motion-scramble speed="35" iterations="3" hover>
 *   DECODE_ME
 * </motion-scramble>
 * ```
 */
@customElement('motion-scramble')
export class MotionScramble extends LitElement implements MotionScrambleProps {
  /** Time between glyph swaps, in milliseconds. */
  @property({ type: Number }) speed = 40
  /** Delay before scrambling starts, in milliseconds. */
  @property({ type: Number }) delay = 0
  /** Number of random-glyph frames per character before locking in. */
  @property({ type: Number }) iterations = 2
  /** When `true`, only scramble the first time the element enters view. */
  @property({ type: Boolean }) once = true
  /** When `true`, trigger on hover instead of viewport entry. */
  @property({ type: Boolean, reflect: true }) hover = false

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
  private raf: number | null = null
  private observer: IntersectionObserver | null = null
  private triggered = false

  connectedCallback() {
    // eslint-disable-next-line wc/no-child-traversal-in-connectedcallback
    this.full = this.textContent?.trim() ?? ''
    this.displayed = this.full
    this.textContent = ''
    super.connectedCallback()

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    if (this.hover) {
      this.addEventListener('mouseenter', this.trigger)
    } else {
      this.observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !this.triggered) {
            if (this.delay) {
              setTimeout(() => this.trigger(), this.delay)
            } else {
              this.trigger()
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
    this.removeEventListener('mouseenter', this.trigger)
    if (this.raf) cancelAnimationFrame(this.raf)
  }

  private trigger = () => {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.frame = 0
    this.iter = 0
    this.scramble()
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

    if (revealed < len) {
      this.raf = requestAnimationFrame(() => setTimeout(() => this.scramble(), this.speed))
    } else {
      this.displayed = this.full
    }
  }

  /** Re-runs the scramble animation. */
  replay() {
    this.triggered = false
    this.trigger()
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
