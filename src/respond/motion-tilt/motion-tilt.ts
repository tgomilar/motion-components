import { LitElement, html, css } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import { animate } from 'motion'
import type { AnimationPlaybackControls } from 'motion'
import type { MotionTiltProps } from './motion-tilt.types.js'

export type { MotionTiltProps } from './motion-tilt.types.js'

/**
 * 3D tilt-on-hover primitive. Rotates slotted content along X/Y based on
 * cursor position with a soft drop-shadow that tracks the tilt.
 * Optional gloss overlay adds a moving highlight.
 *
 * @element motion-tilt
 *
 * @slot - The content to tilt. Border-radius is mirrored onto the inner wrapper.
 *
 * @example
 * ```html
 * <motion-tilt max="20" gloss>
 *   <img src="card.jpg" alt="" />
 * </motion-tilt>
 * ```
 */
@customElement('motion-tilt')
export class MotionTilt extends LitElement implements MotionTiltProps {
  /** Maximum tilt angle in degrees on each axis. */
  @property({ type: Number }) max = 15
  /** Reserved for future use; tilt is governed by spring stiffness/damping. */
  @property({ type: Number }) duration = 0.6
  /** Scale factor while hovering. */
  @property({ type: Number }) scale = 1.04
  /** When `true`, render a moving radial-gradient gloss highlight overlay. */
  @property({ type: Boolean }) gloss = false

  @query('.inner') private inner!: HTMLElement
  @query('.gloss') private glossEl!: HTMLElement
  @query('slot') private slotEl!: HTMLSlotElement

  static styles = css`
    :host {
      display: inline-block;
      perspective: 900px;
    }

    .inner {
      position: relative;
      will-change: transform;
      overflow: hidden;
    }

    .gloss {
      position: absolute;
      inset: 0;
      pointer-events: none;
      opacity: 0;
      z-index: 1;
    }
  `

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  private glossAnim: AnimationPlaybackControls | null = null

  connectedCallback() {
    super.connectedCallback()
    this.addEventListener('mouseenter', this.onEnter)
    this.addEventListener('mousemove', this.onMove)
    this.addEventListener('mouseleave', this.onLeave)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener('mouseenter', this.onEnter)
    this.removeEventListener('mousemove', this.onMove)
    this.removeEventListener('mouseleave', this.onLeave)
    this.glossAnim?.stop()
  }

  firstUpdated() {
    this.syncRadius()
    this.slotEl.addEventListener('slotchange', () => this.syncRadius())
  }

  private syncRadius() {
    const assigned = this.slotEl?.assignedElements()[0] as HTMLElement | undefined
    if (assigned) {
      const radius = getComputedStyle(assigned).borderRadius
      this.inner.style.borderRadius = radius
    }
  }

  private onEnter = () => {
    if (this.reduced || !this.gloss || !this.glossEl) return
    this.glossAnim?.stop()
    this.glossAnim = animate(
      this.glossEl,
      { opacity: [0, 1] },
      { type: 'spring', bounce: 0, duration: 0.3 },
    )
  }

  private onMove = (e: MouseEvent) => {
    if (this.reduced) return
    const rect = this.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height
    const rotateX = (0.5 - py) * this.max * 2
    const rotateY = (px - 0.5) * this.max * 2

    animate(
      this.inner,
      { rotateX, rotateY, scale: this.scale },
      { type: 'spring', stiffness: 180, damping: 22 },
    )

    const lift = (Math.abs(rotateX) + Math.abs(rotateY)) / (this.max * 4)
    const shadowX = -rotateY * 0.6
    const shadowY = rotateX * 0.6
    const shadowOpacity = 0.1 + lift * 0.22
    this.inner.style.filter = `drop-shadow(${shadowX}px ${shadowY}px 22px rgba(0,0,0,${shadowOpacity.toFixed(2)}))`

    if (this.gloss && this.glossEl) {
      const gx = px * 100
      const gy = py * 100
      this.glossEl.style.background = [
        `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 50%, transparent 70%)`,
        `linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 55%)`,
      ].join(', ')
    }
  }

  private onLeave = () => {
    if (this.reduced) return
    animate(
      this.inner,
      { rotateX: 0, rotateY: 0, scale: 1 },
      { type: 'spring', stiffness: 140, damping: 18 },
    )

    this.inner.style.filter = ''

    if (this.gloss && this.glossEl) {
      this.glossAnim?.stop()
      this.glossAnim = animate(
        this.glossEl,
        { opacity: 0 },
        { type: 'spring', bounce: 0, duration: 0.2 },
      )
    }
  }

  render() {
    return html`
      <div class="inner">
        <slot></slot>
        ${this.gloss ? html`<div class="gloss"></div>` : ''}
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-tilt': MotionTilt
  }
}
