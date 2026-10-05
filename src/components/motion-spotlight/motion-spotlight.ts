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
 * **Use it for:** a soft glow that follows the pointer over cards, feature
 * panels or a hero section, as a decorative touch.
 *
 * **Avoid it for:** anything that carries meaning, because keyboard, touch
 * and reduced motion users may never see it. To move or lift the element
 * itself on hover, use `motion-hover` or `motion-tilt`.
 *
 * **Accessibility:** the glow layer has `aria-hidden="true"` and ignores the
 * pointer, so it does not change what screen readers read or what people can
 * click. When content inside it takes keyboard focus, the glow fades in at the
 * last pointer position, or at the center when the pointer is not over it.
 *
 * **Reduced motion:** the glow does not show and does not follow the pointer.
 *
 * **Common mistakes:** setting `border-radius` on the inner card only; the
 * glow copies the radius of `motion-spotlight`, so round the host too. Using
 * a strong `--mc-spotlight-color` over text; the glow sits on top of the
 * content and can lower the text contrast.
 *
 * @element motion-spotlight
 *
 * @slot - The content the spotlight overlays.
 *
 * @cssprop --mc-spotlight-color - Center color of the radial gradient. Default `rgba(255,255,255,0.18)`.
 *
 * @example
 * ```html
 * <motion-spotlight size="500" style="--mc-spotlight-color: rgba(96,165,250,0.25)">
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
    this.addEventListener('focusin', this.onFocus)
    this.addEventListener('focusout', this.onBlur)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener('pointerenter', this.onEnter)
    this.removeEventListener('pointermove', this.onMove)
    this.removeEventListener('pointerleave', this.onLeave)
    this.removeEventListener('focusin', this.onFocus)
    this.removeEventListener('focusout', this.onBlur)
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

  private onFocus = () => {
    if (this.reduced) return
    if (!this.seeded) this.place(this.offsetWidth / 2, this.offsetHeight / 2)
    this.fade(1)
  }

  private onBlur = () => this.fade(0)

  private onMove = (e: PointerEvent) => {
    if (this.reduced) return
    const r = this.getBoundingClientRect()
    const tx = e.clientX - r.left
    const ty = e.clientY - r.top
    if (!this.seeded) {
      this.place(tx, ty)
      this.seeded = true
      return
    }
    animate(this.x, tx, this.spring)
    animate(this.y, ty, this.spring)
  }

  private place(x: number, y: number) {
    this.x.jump(x)
    this.y.jump(y)
    this.paint()
  }

  private paint = () => {
    if (!this.spot) return
    this.spot.style.background = `radial-gradient(${this.size}px circle at ${this.x.get()}px ${this.y.get()}px, var(--mc-spotlight-color, rgba(255,255,255,0.18)), transparent 60%)`
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
