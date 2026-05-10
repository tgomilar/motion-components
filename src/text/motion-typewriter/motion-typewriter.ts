import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type { MotionTypewriterProps } from './motion-typewriter.types.js'

export type { MotionTypewriterProps } from './motion-typewriter.types.js'

const sheet = new CSSStyleSheet()
sheet.replaceSync('motion-typewriter:not(:defined) { opacity: 0 !important; }')
document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]

/**
 * Typewriter text effect. Reveals slotted text character-by-character,
 * with optional looping (type → pause → erase → retype) and a blinking caret.
 *
 * @element motion-typewriter
 *
 * @slot - The text to type. Plain text only — read once on connect.
 *
 * @example
 * ```html
 * <motion-typewriter speed="40" loop pause="2000">
 *   Hello, world.
 * </motion-typewriter>
 * ```
 */
@customElement('motion-typewriter')
export class MotionTypewriter extends LitElement implements MotionTypewriterProps {
  /** Time between characters while typing, in milliseconds. */
  @property({ type: Number }) speed = 50
  /** Delay before typing starts after viewport entry, in milliseconds. */
  @property({ type: Number }) delay = 0
  /** Pause at the end of the line before erasing (loop mode), in milliseconds. */
  @property({ type: Number }) pause = 1800
  /** When `true`, type → pause → erase → retype on repeat. */
  @property({ type: Boolean }) loop = false
  /** When `true`, render a blinking caret after the typed text. */
  @property({ type: Boolean }) cursor = true

  @state() private displayed = ''

  static styles = css`
    :host {
      display: inline;
    }

    .cursor {
      display: inline-block;
      width: 2px;
      height: 1.1em;
      background: currentColor;
      margin-left: 2px;
      vertical-align: text-bottom;
      animation: blink 1s step-end infinite;
    }

    .cursor.done {
      animation-delay: 0.5s;
    }

    @keyframes blink {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0;
      }
    }
  `

  private full = ''
  private timer: ReturnType<typeof setTimeout> | null = null
  private index = 0
  private observer: IntersectionObserver | null = null

  connectedCallback() {
    // eslint-disable-next-line wc/no-child-traversal-in-connectedcallback
    this.full = this.textContent?.trim() ?? ''
    this.textContent = ''
    super.connectedCallback()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.displayed = this.full
      return
    }
    this.observer = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          this.observer?.disconnect()
          setTimeout(() => this.type(), this.delay)
        }
      },
      { threshold: 0.2 },
    )
    this.observer.observe(this)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.observer?.disconnect()
    if (this.timer) clearTimeout(this.timer)
  }

  private type() {
    if (this.index > this.full.length) {
      if (this.loop) {
        this.timer = setTimeout(() => this.erase(), this.pause)
      }
      return
    }
    this.displayed = this.full.slice(0, this.index)
    this.index++
    this.timer = setTimeout(() => this.type(), this.speed)
  }

  private erase() {
    if (this.index <= 0) {
      this.timer = setTimeout(() => this.type(), this.speed * 4)
      return
    }
    this.index--
    this.displayed = this.full.slice(0, this.index)
    this.timer = setTimeout(() => this.erase(), this.speed * 0.5)
  }

  /** Resets and re-runs the typing animation from the start. */
  replay() {
    if (this.timer) clearTimeout(this.timer)
    this.index = 0
    this.displayed = ''
    setTimeout(() => this.type(), this.delay)
  }

  private get done() {
    return !this.loop && this.displayed === this.full
  }

  render() {
    return html`${this.displayed}${this.cursor
      ? html`<span class="cursor ${this.done ? 'done' : ''}"></span>`
      : ''}`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-typewriter': MotionTypewriter
  }
}
