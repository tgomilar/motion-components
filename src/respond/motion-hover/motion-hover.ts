import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { animate } from 'motion'
import type { MotionHoverProps } from './motion-hover.types.js'

export type { MotionHoverProps } from './motion-hover.types.js'

/**
 * Spring-based hover transform primitive. Animates scale, translation, rotation,
 * and skew on mouse enter, springs back on leave. Composes with any slotted content.
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
    this.addEventListener('mouseenter', this.onEnter)
    this.addEventListener('mouseleave', this.onLeave)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener('mouseenter', this.onEnter)
    this.removeEventListener('mouseleave', this.onLeave)
  }

  private get spring() {
    return { type: 'spring', bounce: this.bounce, duration: this.duration } as const
  }

  private onEnter = () => {
    if (this.reduced) return
    animate(
      this,
      { scale: this.scale, x: this.x, y: this.y, rotate: this.rotate, skewX: this.skew },
      this.spring,
    )
  }

  private onLeave = () => {
    if (this.reduced) return
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
