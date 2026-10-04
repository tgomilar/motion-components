import { LitElement, html, css } from 'lit'
import { property } from 'lit/decorators.js'
import { animate } from 'motion'
import { registerDisableable, unregisterDisableable } from '../../utils/registry.js'
import type { MotionPressProps } from './motion-press.types.js'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'

export type { MotionPressProps } from './motion-press.types.js'

/**
 * Tactile press primitive. Scales slotted content down on `pointerdown`
 * and bounces back on release for a physical click feel.
 *
 * **Use it for:** buttons, toggles and clickable cards that should shrink a
 * little while pressed with a mouse, finger or pen, then spring back on
 * release.
 *
 * **Avoid it for:** content that does nothing when clicked, because the press
 * makes it look clickable. For hover feedback, use `motion-hover`.
 *
 * **Accessibility:** it adds no role, `tabindex` or keyboard handling, so it
 * does not make content clickable or focusable. Put a real `<button>` or link
 * inside. The effect reacts to pointer input only, so pressing Enter or Space
 * on the button does not show it. Only transform changes, so the layout does
 * not shift.
 *
 * **Reduced motion:** pressing and releasing do nothing, and the content
 * stays at full size.
 *
 * **Common mistakes:** adding the click handler to `motion-press` instead of
 * a button inside it, so keyboard users cannot reach or use it. Wrapping a
 * full width button: the host is `display: inline-block`, so the button can
 * shrink to its content; set `display: block` on `motion-press`.
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
  /** Spring bounciness of the release (0 = no overshoot). */
  @property({ type: Number }) bounce = 0.4
  /** When `true`, ignores pointer input and settles to the rest state. */
  @property({ type: Boolean, converter: flag, reflect: true }) disabled = false

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
    registerDisableable(this)
    this.addEventListener('pointerdown', this.onPress)
    this.addEventListener('pointerup', this.onRelease)
    this.addEventListener('pointerleave', this.onRelease)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    unregisterDisableable(this)
    this.removeEventListener('pointerdown', this.onPress)
    this.removeEventListener('pointerup', this.onRelease)
    this.removeEventListener('pointerleave', this.onRelease)
  }

  updated(changed: Map<string, unknown>) {
    if (changed.get('disabled') === false && this.disabled && !this.reduced) this.settle()
  }

  private onPress = () => {
    if (this.disabled || this.reduced) return
    animate(this, { scale: this.scale }, { type: 'spring', bounce: 0, duration: this.duration })
  }

  private onRelease = () => {
    if (this.disabled || this.reduced) return
    this.settle()
  }

  private settle() {
    animate(this, { scale: 1 }, { type: 'spring', bounce: this.bounce, duration: this.duration })
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
