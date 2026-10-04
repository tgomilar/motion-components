import { LitElement, html, css } from 'lit'
import { property } from 'lit/decorators.js'
import { animate } from 'motion'
import { registerDisableable, unregisterDisableable } from '../../utils/registry.js'
import type { MotionHoverProps } from './motion-hover.types.js'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'

export type { MotionHoverProps } from './motion-hover.types.js'

/**
 * Spring-based hover transform primitive. Animates scale, translation, rotation,
 * and skew on mouse enter, springs back on leave. Composes with any slotted content.
 *
 * **Use it for:** buttons, links, cards and images that should grow, move or
 * rotate a little while the mouse pointer is over them.
 *
 * **Avoid it for:** feedback on click or tap; use `motion-press`. For effects
 * that follow the pointer, use `motion-magnetic` or `motion-tilt`. Do not use
 * it as the only sign that something is interactive, because it does not run
 * on keyboard focus.
 *
 * **Accessibility:** it adds no role, `tabindex` or ARIA attributes, so the
 * slotted content keeps its own role and keyboard behavior. The effect reacts
 * to mouse enter and leave only, so keyboard focus does not trigger it; give
 * the content its own visible focus style. Only transform changes, so the
 * layout does not shift, but the moved content can cover nearby elements.
 *
 * **Reduced motion:** mouse enter and leave do nothing, and the content stays
 * at its rest state.
 *
 * **Common mistakes:** wrapping a block element such as a card. The host is
 * `display: inline-block`, so the card can shrink to the width of its
 * content; set `display: block` on `motion-hover`.
 *
 * @element motion-hover
 *
 * @slot - The content that lifts on hover.
 *
 * @example
 * ```html
 * <motion-hover scale="1.08" rotate="-2">
 *   <button>Hover me</button>
 * </motion-hover>
 * ```
 */
@customElement('motion-hover')
export class MotionHover extends LitElement implements MotionHoverProps {
  /** Scale factor on hover. `1` is no scaling. */
  @property({ type: Number }) scale = 1.05
  /** Horizontal translation in pixels on hover. */
  @property({ type: Number }) x = 0
  /** Vertical translation in pixels on hover. */
  @property({ type: Number }) y = 0
  /** Rotation in degrees on hover. */
  @property({ type: Number }) rotate = 0
  /** Skew along the X axis in degrees on hover. */
  @property({ type: Number }) skew = 0
  /** Spring duration of the hover transition, in seconds. */
  @property({ type: Number }) duration = 0.3
  /** Spring bounciness (0 = critically damped, higher = more elastic). */
  @property({ type: Number }) bounce = 0.3
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
    this.addEventListener('mouseenter', this.onEnter)
    this.addEventListener('mouseleave', this.onLeave)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    unregisterDisableable(this)
    this.removeEventListener('mouseenter', this.onEnter)
    this.removeEventListener('mouseleave', this.onLeave)
  }

  updated(changed: Map<string, unknown>) {
    if (changed.get('disabled') === false && this.disabled && !this.reduced) this.settle()
  }

  private get spring() {
    return { type: 'spring', bounce: this.bounce, duration: this.duration } as const
  }

  private onEnter = () => {
    if (this.disabled || this.reduced) return
    animate(
      this,
      { scale: this.scale, x: this.x, y: this.y, rotate: this.rotate, skewX: this.skew },
      this.spring,
    )
  }

  private onLeave = () => {
    if (this.disabled || this.reduced) return
    this.settle()
  }

  private settle() {
    animate(this, { scale: 1, x: 0, y: 0, rotate: 0, skewX: 0 }, this.spring)
  }

  render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-hover': MotionHover
  }
}
