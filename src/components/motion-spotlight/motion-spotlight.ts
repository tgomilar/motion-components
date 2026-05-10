import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { animate } from 'motion'
import type { AnimationPlaybackControls } from 'motion'
import type { MotionSpotlightProps } from './motion-spotlight.types.js'

export type { MotionSpotlightProps } from './motion-spotlight.types.js'

/**
 * Mouse-tracked radial-gradient spotlight overlay. Wrap any content; the
 * spotlight fades in on hover and lerps toward the cursor for a smooth,
 * weightful feel rather than locking 1:1 to the pointer.
 *
 * @element motion-spotlight
 *
 * @slot - The content the spotlight overlays.
 *
 * @example
 * ```html
 * <motion-spotlight size="500" color="rgba(96,165,250,0.25)">
 *   <div class="card">…</div>
 * </motion-spotlight>
 * ```
 */
@customElement('motion-spotlight')
export class MotionSpotlight extends LitElement implements MotionSpotlightProps {
  /** Diameter of the spotlight in pixels. */
  @property({ type: Number, reflect: true }) size = 400
  /** Center color of the radial gradient. */
  @property({ type: String, reflect: true }) color = 'rgba(255,255,255,0.18)'
  /** Lerp factor (0–1). Lower = smoother lag, higher = snappier follow. */
  @property({ type: Number }) smoothing = 0.18
  /** Fade in/out duration in seconds. */
  @property({ type: Number, attribute: 'fade-duration' }) fadeDuration = 0.3

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
  private tx = 0
  private ty = 0
  private x = 0
  private y = 0
  private raf: number | null = null
  private seeded = false
  private fadeControls: AnimationPlaybackControls | null = null

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  firstUpdated() {
    this.spot = this.renderRoot.querySelector('.spot')
    this.addEventListener('pointerenter', this.onEnter)
    this.addEventListener('pointermove', this.onMove)
    this.addEventListener('pointerleave', this.onLeave)
    this.addEventListener('focusin', this.onFocusIn)
    this.addEventListener('focusout', this.onFocusOut)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener('pointerenter', this.onEnter)
    this.removeEventListener('pointermove', this.onMove)
    this.removeEventListener('pointerleave', this.onLeave)
    this.removeEventListener('focusin', this.onFocusIn)
    this.removeEventListener('focusout', this.onFocusOut)
    this.fadeControls?.stop()
    if (this.raf !== null) cancelAnimationFrame(this.raf)
  }

  private onEnter = () => {
    if (this.reduced || !this.spot) return
    this.fadeControls?.stop()
    this.fadeControls = animate(
      this.spot,
      { opacity: [0, 1] },
      { type: 'spring', bounce: 0, duration: this.fadeDuration },
    )
  }

  private onFocusIn = () => {
    if (this.reduced || !this.spot) return
    this.fadeControls?.stop()
    this.fadeControls = animate(
      this.spot,
      { opacity: [0, 1] },
      { type: 'spring', bounce: 0, duration: this.fadeDuration },
    )
  }

  private onFocusOut = () => {
    if (this.reduced || !this.spot) return
    this.fadeControls?.stop()
    this.fadeControls = animate(
      this.spot,
      { opacity: 0 },
      { type: 'spring', bounce: 0, duration: this.fadeDuration },
    )
  }

  private onMove = (e: PointerEvent) => {
    if (this.reduced) return
    const r = this.getBoundingClientRect()
    this.tx = e.clientX - r.left
    this.ty = e.clientY - r.top
    if (!this.seeded) {
      this.x = this.tx
      this.y = this.ty
      this.seeded = true
    }
    if (this.raf === null) this.raf = requestAnimationFrame(this.tick)
  }

  private onLeave = () => {
    if (this.reduced) return
    this.seeded = false
    this.fadeControls?.stop()
    if (this.spot) {
      this.fadeControls = animate(
        this.spot,
        { opacity: 0 },
        { type: 'spring', bounce: 0, duration: this.fadeDuration },
      )
    }
  }

  private tick = () => {
    const k = Math.min(Math.max(this.smoothing, 0.01), 1)
    this.x += (this.tx - this.x) * k
    this.y += (this.ty - this.y) * k
    if (this.spot) {
      this.spot.style.background = `radial-gradient(${this.size}px circle at ${this.x}px ${this.y}px, ${this.color}, transparent 60%)`
    }
    if (Math.abs(this.tx - this.x) > 0.4 || Math.abs(this.ty - this.y) > 0.4) {
      this.raf = requestAnimationFrame(this.tick)
    } else {
      this.raf = null
    }
  }

  render() {
    return html`<slot></slot>
      <div class="spot" aria-hidden="true"></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-spotlight': MotionSpotlight
  }
}
