import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { animate } from 'motion'
import type { MotionPressProps } from './motion-press.types.js'

export type { MotionPressProps } from './motion-press.types.js'

/**
 * Tactile press primitive. Scales slotted content down on `pointerdown`
 * and bounces back on release for a physical click feel.
 *
 * @element motion-press
 *
 * @slot - The pressable content.
 *
 * @example
 * ```html
 * <motion-press scale="0.92">
 *   <button>Click me</button>
 * </motion-press>
 * ```
 */
@customElement('motion-press')
export class MotionPress extends LitElement implements MotionPressProps {
  /** Scale factor while pressed. `1` is no shrink. */
  @property({ type: Number }) scale = 0.95
  /** Duration of press and release transitions, in seconds. */
  @property({ type: Number }) duration = 0.15

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
    this.addEventListener('pointerdown', this.onPress)
    this.addEventListener('pointerup', this.onRelease)
    this.addEventListener('pointerleave', this.onRelease)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener('pointerdown', this.onPress)
    this.removeEventListener('pointerup', this.onRelease)
    this.removeEventListener('pointerleave', this.onRelease)
  }

  private onPress = () => {
    if (this.reduced) return
    animate(this, { scale: this.scale }, { type: 'spring', bounce: 0, duration: this.duration })
  }

  private onRelease = () => {
    if (this.reduced) return
    animate(this, { scale: 1 }, { type: 'spring', bounce: 0.4, duration: this.duration })
  }

  render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-press': MotionPress
  }
}
