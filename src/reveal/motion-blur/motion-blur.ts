import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { animate, scroll } from 'motion'
import type { MotionBlurProps, BlurDirection } from './motion-blur.types.js'

export type { MotionBlurProps, BlurDirection } from './motion-blur.types.js'

/**
 * Scroll-driven blur reveal. Maps the element's scroll progress through the
 * viewport to opacity, blur, and Y-translation. Direction controls whether the
 * blur happens on entry, exit, or both.
 *
 * @element motion-blur
 *
 * @slot - The content to blur on scroll.
 *
 * @example
 * ```html
 * <motion-blur blur="14" y="20" direction="in">
 *   <img src="hero.jpg" alt="" />
 * </motion-blur>
 * ```
 */
@customElement('motion-blur')
export class MotionBlur extends LitElement implements MotionBlurProps {
  /** Reserved for future use; reveal speed is driven by scroll progress. */
  @property({ type: Number }) duration = 0.7
  /** Maximum blur amount in pixels at the unfocused extreme. */
  @property({ type: Number, attribute: 'blur' }) amount = 10
  /** Vertical translation in pixels at the unfocused extreme. */
  @property({ type: Number }) y = 12
  /** Reserved for future use; the scroll handler defines its own offsets. */
  @property({ type: Number }) threshold = 0.1
  /** When `true` (and `direction="in"`), latch focused state on first reveal. */
  @property({ type: Boolean }) once = true
  /** `'in'` blurs on entry, `'out'` blurs on exit, `'both'` blur-focus-blur. */
  @property({ type: String, reflect: true }) direction: BlurDirection = 'in'

  static styles = css`
    :host {
      display: block;
    }
  `

  private cleanup: (() => void) | null = null
  private latched = false

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  connectedCallback() {
    super.connectedCallback()
    // Set initial hidden state before first paint to avoid flash
    if (this.direction !== 'out' && !this.reduced) {
      this.style.opacity = '0'
    }
  }

  firstUpdated() {
    if (this.reduced) {
      this.style.opacity = '1'
      this.style.filter = ''
      this.style.transform = ''
      return
    }
    this.bind()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.cleanup?.()
    this.cleanup = null
  }

  private bind() {
    this.cleanup?.()
    this.latched = false

    if (this.direction === 'in') {
      this.cleanup = scroll(
        (progress: number) => {
          if (this.latched) return
          const p = Math.max(0, Math.min(1, progress))
          this.style.opacity = String(p)
          this.style.filter = `blur(${this.amount * (1 - p)}px)`
          this.style.transform = `translateY(${this.y * (1 - p)}px)`
          if (this.once && p >= 1) {
            this.latched = true
            this.style.filter = ''
            this.style.transform = ''
            this.cleanup?.()
            this.cleanup = null
          }
        },
        { target: this, offset: ['start end', 'center center'] },
      )
    } else if (this.direction === 'out') {
      this.cleanup = scroll(
        (progress: number) => {
          const p = Math.max(0, Math.min(1, progress))
          this.style.opacity = String(1 - p)
          this.style.filter = `blur(${this.amount * p}px)`
          this.style.transform = `translateY(${-this.y * p}px)`
        },
        { target: this, offset: ['center center', 'end start'] },
      )
    } else {
      // direction === 'both': blur in as element enters, blur out as element exits
      this.cleanup = scroll(
        (progress: number) => {
          const p = Math.max(0, Math.min(1, progress))
          // Bell curve: 0 at entry, peaks at 0.5 (element centered), 0 at exit
          const bellP = 1 - Math.abs(p * 2 - 1)
          this.style.opacity = String(bellP)
          this.style.filter = `blur(${this.amount * (1 - bellP)}px)`
          this.style.transform = `translateY(${this.y * (1 - 2 * p)}px)`
        },
        { target: this, offset: ['start end', 'end start'] },
      )
    }
  }

  /** Resets the latch and re-binds the scroll handler. */
  replay() {
    this.cleanup?.()
    this.cleanup = null
    this.latched = false

    if (this.reduced) {
      this.style.opacity = '1'
      this.style.filter = ''
      this.style.transform = ''
      return
    }

    if (this.direction === 'in') {
      this.style.opacity = '0'
      this.style.filter = `blur(${this.amount}px)`
      this.style.transform = `translateY(${this.y}px)`
      this.bind()
      return
    }

    animate(this, { opacity: 1 }, { type: 'spring', bounce: 0, duration: 0.3 })
    this.style.filter = ''
    this.style.transform = ''
    setTimeout(() => this.bind(), 330)
  }

  render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-blur': MotionBlur
  }
}
