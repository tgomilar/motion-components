import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { animate } from 'motion'
import { useIntersect } from '../utils/use-intersect.js'
import type { MotionCounterProps } from './motion-counter.types.js'

export type { MotionCounterProps } from './motion-counter.types.js'

const sheet = new CSSStyleSheet()
sheet.replaceSync('motion-counter:not(:defined) { opacity: 0 !important; }')
document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]

/**
 * Animated number counter. Springs from `from` to `to` once the element
 * scrolls into view. Use `prefix`/`suffix` for currency or units, `decimals`
 * for fractional precision.
 *
 * @element motion-counter
 *
 * @example
 * ```html
 * <motion-counter from="0" to="2024" duration="2"></motion-counter>
 * <motion-counter to="99" suffix="%" decimals="0"></motion-counter>
 * ```
 */
@customElement('motion-counter')
export class MotionCounter extends LitElement implements MotionCounterProps {
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
  /** When `true`, only count the first time the element enters view. */
  @property({ type: Boolean }) once = true

  @state() private value = 0

  static styles = css`
    :host {
      display: inline;
      font-variant-numeric: tabular-nums;
    }
  `

  private disconnectIntersect: (() => void) | null = null
  private animated = false

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  connectedCallback() {
    super.connectedCallback()
    this.value = this.from
    this.disconnectIntersect = useIntersect(this, 0.2, () => {
      if (!this.animated) {
        this.play()
        if (this.once) {
          this.animated = true
          this.disconnectIntersect?.()
        }
      }
    })
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.disconnectIntersect?.()
  }

  private play() {
    if (this.reduced) {
      this.value = this.to
      return
    }
    const counter = { value: this.from }
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
      },
    )
  }

  /** Resets the counter to `from` and re-runs the count animation. */
  replay() {
    this.animated = false
    this.value = this.from
    this.play()
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
