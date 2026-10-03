import { LitElement, html, css } from 'lit'
import { property } from 'lit/decorators.js'
import { animate, motionValue } from 'motion'
import type { AnimationPlaybackControls } from 'motion'
import type { MotionSpotlightProps } from './motion-spotlight.types.js'
import { customElement } from '../../utils/define.js'

export type { MotionSpotlightProps } from './motion-spotlight.types.js'

/**
 * Mouse-tracked radial-gradient spotlight overlay. Wrap any content; the
 * spotlight fades in on hover and springs toward the cursor for a smooth,
 * weightful feel rather than locking 1:1 to the pointer.
 *
 * @element motion-spotlight
 *
 * @slot - The content the spotlight overlays.
 *
 * @cssprop --spotlight-color - Center color of the radial gradient. Default `rgba(255,255,255,0.18)`.
 *
 * @example
 * ```html
 * <motion-spotlight size="500" style="--spotlight-color: rgba(96,165,250,0.25)">
 *   <div class="card">…</div>
 * </motion-spotlight>
 * ```
 */
@customElement('motion-spotlight')
export class MotionSpotlight extends LitElement implements MotionSpotlightProps {
  /** Diameter of the spotlight in pixels. */
  @property({ type: Number, reflect: true }) size = 400
  /** Spring duration of the follow and the fade, in seconds. Higher trails the cursor more. */
  @property({ type: Number }) duration = 0.35
  /** Spring bounciness of the follow (0 = no overshoot). */
  @property({ type: Number }) bounce = 0

  static styles = css`
    :host {
      display: block;
      position: relative;
      isolation: isolate;
    }
    .spot {
      position: absolute;
      inset: 0;
      pointer-events: none;
      opacity: 0;
      border-radius: inherit;
    }
    :host(:focus-within) .spot {
      opacity: 1;
    }
  `

  private spot: HTMLDivElement | null = null
  private x = motionValue(0)
  private y = motionValue(0)
  private seeded = false
  private fadeControls: AnimationPlaybackControls | null = null
  private stopPaint: (() => void)[] = []

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  private get spring() {
    return { type: 'spring' as const, duration: this.duration, bounce: this.bounce }
  }

  firstUpdated() {
    this.spot = this.renderRoot.querySelector('.spot')
    this.stopPaint = [this.x.on('change', this.paint), this.y.on('change', this.paint)]
    this.addEventListener('pointerenter', this.onEnter)
    this.addEventListener('pointermove', this.onMove)
    this.addEventListener('pointerleave', this.onLeave)
    this.addEventListener('focusin', this.onEnter)
    this.addEventListener('focusout', this.onLeave)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener('pointerenter', this.onEnter)
    this.removeEventListener('pointermove', this.onMove)
    this.removeEventListener('pointerleave', this.onLeave)
    this.removeEventListener('focusin', this.onEnter)
    this.removeEventListener('focusout', this.onLeave)
    this.fadeControls?.stop()
    this.x.stop()
    this.y.stop()
    this.stopPaint.forEach((stop) => stop())
  }

  private fade(to: number) {
    if (this.reduced || !this.spot) return
    this.fadeControls?.stop()
    this.fadeControls = animate(
      this.spot,
      { opacity: to },
      { type: 'spring', bounce: 0, duration: this.duration },
    )
  }

  private onEnter = () => this.fade(1)

  private onLeave = () => {
    this.seeded = false
    this.fade(0)
  }

  private onMove = (e: PointerEvent) => {
    if (this.reduced) return
    const r = this.getBoundingClientRect()
    const tx = e.clientX - r.left
    const ty = e.clientY - r.top
    if (!this.seeded) {
      this.x.jump(tx)
      this.y.jump(ty)
      this.seeded = true
      this.paint()
      return
    }
    animate(this.x, tx, this.spring)
    animate(this.y, ty, this.spring)
  }

  private paint = () => {
    if (!this.spot) return
    this.spot.style.background = `radial-gradient(${this.size}px circle at ${this.x.get()}px ${this.y.get()}px, var(--spotlight-color, rgba(255,255,255,0.18)), transparent 60%)`
  }

  render() {
    return html`<slot></slot> <div class="spot" aria-hidden="true"></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-spotlight': MotionSpotlight
  }
}
