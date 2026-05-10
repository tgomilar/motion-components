import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { animate, scroll } from 'motion'
import type { MotionParallaxProps } from './motion-parallax.types.js'

export type { MotionParallaxProps } from './motion-parallax.types.js'

/**
 * Lightweight parallax scroll primitive. Moves the slotted content along the
 * chosen axis at a configurable speed relative to the scroll position.
 *
 * @element motion-parallax
 *
 * @slot - The content that parallax-scrolls.
 *
 * @example
 * ```html
 * <motion-parallax speed="0.3" axis="y">
 *   <img src="background.jpg" alt="" />
 * </motion-parallax>
 * ```
 */
@customElement('motion-parallax')
export class MotionParallax extends LitElement implements MotionParallaxProps {
  /** Parallax intensity. `0` = no movement (scrolls with page), `1` = strong drift. */
  @property({ type: Number }) speed = 0.5
  /** Scroll axis: `'x'` for horizontal, `'y'` for vertical. */
  @property({ type: String }) axis: 'x' | 'y' = 'y'

  static styles = css`
    :host {
      display: block;
      will-change: transform;
    }
  `

  private cleanup: (() => void) | null = null

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  firstUpdated() {
    this.bind()
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('speed') || changed.has('axis')) {
      this.cleanup?.()
      this.bind()
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.cleanup?.()
    this.cleanup = null
  }

  private bind() {
    if (this.reduced) return

    const factor = this.speed
    const range = 80 // px

    const keyframes =
      this.axis === 'x'
        ? { x: [`${factor * range}px`, `${-(factor * range)}px`] }
        : { y: [`${factor * range}px`, `${-(factor * range)}px`] }

    this.cleanup = scroll(animate(this, keyframes, { ease: 'linear' }), {
      target: this,
      offset: ['start end', 'end start'],
    })
  }

  render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-parallax': MotionParallax
  }
}
