import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { animate } from 'motion'
import type { MotionBlurInProps } from './motion-blur-in.types.js'

export type { MotionBlurInProps } from './motion-blur-in.types.js'

/**
 * Viewport-triggered blur reveal. Starts blurred and translated, snaps to
 * focus once the element enters the viewport. The dominant editorial
 * entrance pattern of 2024–2025.
 *
 * @element motion-blur-in
 *
 * @slot - The content to blur-reveal.
 *
 * @example
 * ```html
 * <motion-blur-in blur="12" y="8" duration="0.7">
 *   <h1>Headline</h1>
 * </motion-blur-in>
 * ```
 */
@customElement('motion-blur-in')
export class MotionBlurIn extends LitElement implements MotionBlurInProps {
  /** Spring duration of the reveal animation, in seconds. */
  @property({ type: Number }) duration = 0.7
  /** Initial blur in pixels; animates to 0 on reveal. */
  @property({ type: Number, attribute: 'blur' }) amount = 10
  /** Initial vertical offset in pixels; animates to 0 on reveal. */
  @property({ type: Number }) y = 12
  /** IntersectionObserver threshold (0–1) at which the reveal triggers. */
  @property({ type: Number }) threshold = 0.1
  /** When `true`, only animate the first time the element enters view. */
  @property({ type: Boolean }) once = true

  static styles = css`
    :host {
      display: block;
    }
  `

  private observer: IntersectionObserver | null = null
  private revealed = false

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  connectedCallback() {
    super.connectedCallback()
    if (!this.reduced) {
      this.style.opacity = '0'
    }
  }

  firstUpdated() {
    if (!this.reduced) {
      this.style.filter = `blur(${this.amount}px)`
    }

    this.observer = new IntersectionObserver(this.onIntersect, { threshold: this.threshold })
    this.observer.observe(this)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.observer?.disconnect()
  }

  private onIntersect = (entries: IntersectionObserverEntry[]) => {
    for (const entry of entries) {
      if (entry.isIntersecting && !this.revealed) {
        this.play()
        if (this.once) {
          this.revealed = true
          this.observer?.disconnect()
        }
      }
    }
  }

  private play() {
    if (this.reduced) {
      this.style.opacity = '1'
      this.style.filter = ''
      return
    }
    animate(
      this,
      {
        opacity: [0, 1],
        filter: [`blur(${this.amount}px)`, 'blur(0px)'],
        y: [this.y, 0],
      },
      { duration: this.duration, type: 'spring', bounce: 0.1 },
    )
  }

  /** Resets to the blurred initial state and re-runs the reveal. */
  replay() {
    this.revealed = false
    this.style.opacity = '0'
    this.style.filter = `blur(${this.amount}px)`
    this.play()
  }

  render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-blur-in': MotionBlurIn
  }
}
