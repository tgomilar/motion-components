import { LitElement, html, css } from 'lit'
import { property } from 'lit/decorators.js'
import { animate } from 'motion'
import { registerDisableable, unregisterDisableable } from '../../utils/registry.js'
import type { MotionMagneticProps } from './motion-magnetic.types.js'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'

export type { MotionMagneticProps } from './motion-magnetic.types.js'

/**
 * Magnetic cursor pull. Slotted content drifts toward the pointer by
 * `strength`, springs back when the mouse leaves. Best on small interactive
 * targets like buttons and icons.
 *
 * **Use it for:** small targets such as buttons, icon buttons and short links
 * that should drift a little toward the mouse pointer.
 *
 * **Avoid it for:** large areas such as cards or images. The pull is a
 * fraction of the distance from the center, so large elements move far. Use
 * `motion-tilt` or `motion-hover` there.
 *
 * **Accessibility:** it adds no role, `tabindex` or ARIA attributes, so the
 * slotted content keeps its own role and keyboard behavior. The pull reacts
 * to mouse movement only, so keyboard focus does not move it. Only transform
 * changes, so the layout does not shift. Put a real link or button inside.
 *
 * **Reduced motion:** mouse movement does nothing, and the content stays in
 * its normal position.
 *
 * **Common mistakes:** expecting the pull to start before the pointer reaches
 * the element. It reacts only while the pointer is over `motion-magnetic`
 * itself; to make the active area larger, add `padding` to `motion-magnetic`.
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
  /** Spring bounciness of the pull and release (0 = no overshoot). */
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
    this.addEventListener('mousemove', this.onMove)
    this.addEventListener('mouseleave', this.onLeave)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    unregisterDisableable(this)
    this.removeEventListener('mousemove', this.onMove)
    this.removeEventListener('mouseleave', this.onLeave)
  }

  updated(changed: Map<string, unknown>) {
    if (changed.get('disabled') === false && this.disabled && !this.reduced) this.settle()
  }

  private onMove = (e: MouseEvent) => {
    if (this.disabled || this.reduced) return
    const rect = this.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = (e.clientX - cx) * this.strength
    const dy = (e.clientY - cy) * this.strength
    animate(
      this,
      { x: dx, y: dy },
      { type: 'spring', bounce: this.bounce, duration: this.duration },
    )
  }

  private onLeave = () => {
    if (this.disabled || this.reduced) return
    this.settle()
  }

  private settle() {
    animate(this, { x: 0, y: 0 }, { type: 'spring', bounce: this.bounce, duration: this.duration })
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
