import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { animate } from 'motion'
import type { MotionMagneticProps } from './motion-magnetic.types.js'

export type { MotionMagneticProps } from './motion-magnetic.types.js'

/**
 * Magnetic cursor pull. Slotted content drifts toward the pointer by
 * `strength`, springs back when the mouse leaves. Best on small interactive
 * targets like buttons and icons.
 *
 * @element motion-magnetic
 *
 * @slot - The element that follows the cursor.
 *
 * @example
 * ```html
 * <motion-magnetic strength="0.5">
 *   <a href="/contact">Contact</a>
 * </motion-magnetic>
 * ```
 */
@customElement('motion-magnetic')
export class MotionMagnetic extends LitElement implements MotionMagneticProps {
  /** Pull strength as a fraction of cursor-to-center distance. */
  @property({ type: Number }) strength = 0.4
  /** Spring duration of the pull and release transitions, in seconds. */
  @property({ type: Number }) duration = 0.5

  static styles = css`
    :host {
      display: inline-block;
    }
  `

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  connectedCallback() {
    super.connectedCallback()
    this.addEventListener('mousemove', this.onMove)
    this.addEventListener('mouseleave', this.onLeave)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener('mousemove', this.onMove)
    this.removeEventListener('mouseleave', this.onLeave)
  }

  private onMove = (e: MouseEvent) => {
    if (this.reduced) return
    const rect = this.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = (e.clientX - cx) * this.strength
    const dy = (e.clientY - cy) * this.strength
    animate(this, { x: dx, y: dy }, { type: 'spring', bounce: 0.3, duration: this.duration })
  }

  private onLeave = () => {
    if (this.reduced) return
    animate(this, { x: 0, y: 0 }, { type: 'spring', bounce: 0.4, duration: this.duration })
  }

  render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-magnetic': MotionMagnetic
  }
}
