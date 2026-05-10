import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { animate } from 'motion'
import type { MotionFlipCardProps, FlipTrigger, FlipAxis } from './motion-flip-card.types.js'

export type { MotionFlipCardProps, FlipTrigger, FlipAxis } from './motion-flip-card.types.js'

/**
 * Two-sided card that flips between a `front` and `back` slot with spring
 * physics. Trigger on hover or click; choose the rotation axis.
 *
 * @element motion-flip-card
 *
 * @slot front - The face shown at rest.
 * @slot back  - The face revealed after flipping.
 *
 * @example
 * ```html
 * <motion-flip-card trigger="click" axis="y">
 *   <div slot="front" class="card">Tap me</div>
 *   <div slot="back"  class="card">Hello, back side.</div>
 * </motion-flip-card>
 * ```
 */
// @preload host — 3D perspective is set imperatively; preload prevents layout flash before registration
@customElement('motion-flip-card')
export class MotionFlipCard extends LitElement implements MotionFlipCardProps {
  /** What flips the card: `'hover'` or `'click'`. */
  @property({ type: String, reflect: true }) trigger: FlipTrigger = 'hover'
  /** Rotation axis: `'y'` (around vertical) or `'x'` (around horizontal). */
  @property({ type: String, reflect: true }) axis: FlipAxis = 'y'
  /** Spring duration of the flip, in seconds. */
  @property({ type: Number }) duration = 0.7
  /** Spring bounciness (0 = critically damped, higher = more elastic). */
  @property({ type: Number }) bounce = 0.2
  /** CSS perspective applied to the host, in pixels. */
  @property({ type: Number, reflect: true }) perspective = 1000

  @state() private flipped = false

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  static styles = css`
    :host {
      display: inline-block;
      position: relative;
    }
    .scene {
      position: relative;
      width: 100%;
      height: 100%;
      transform-style: preserve-3d;
      transform: rotateY(0.0001deg);
    }
    .face {
      position: absolute;
      inset: 0;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
    }
    .face.back {
      transform: rotateY(180deg);
    }
    :host([axis='x']) .face.back {
      transform: rotateX(180deg);
    }
    ::slotted(*) {
      display: block;
      width: 100%;
      height: 100%;
    }
  `

  private scene: HTMLElement | null = null

  firstUpdated() {
    this.scene = this.renderRoot.querySelector('.scene')
    this.style.perspective = `${this.perspective}px`
    if (this.trigger === 'hover') {
      this.addEventListener('pointerenter', this.onEnter)
      this.addEventListener('pointerleave', this.onLeave)
    } else {
      this.addEventListener('click', this.onClick)
      this.setAttribute('tabindex', '0')
      this.setAttribute('role', 'button')
      this.addEventListener('keydown', this.onKey)
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener('pointerenter', this.onEnter)
    this.removeEventListener('pointerleave', this.onLeave)
    this.removeEventListener('click', this.onClick)
    this.removeEventListener('keydown', this.onKey)
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('perspective')) this.style.perspective = `${this.perspective}px`
  }

  private onEnter = () => this.applyFlip(true)
  private onLeave = () => this.applyFlip(false)
  private onClick = () => this.applyFlip(!this.flipped)
  private onKey = (e: KeyboardEvent) => {
    if (e.key !== ' ' && e.key !== 'Enter') return
    e.preventDefault()
    this.applyFlip(!this.flipped)
  }

  private applyFlip(to: boolean) {
    if (to === this.flipped || !this.scene) return
    this.flipped = to
    const target = to ? 180 : 0
    const key = this.axis === 'y' ? 'rotateY' : 'rotateX'
    if (this.reduced) {
      this.scene.style.transform = `${key}(${target}deg)`
      return
    }
    animate(
      this.scene,
      { [key]: target },
      {
        type: 'spring',
        bounce: this.bounce,
        duration: this.duration,
      },
    )
  }

  /** Toggles the card programmatically. */
  flip() {
    this.applyFlip(!this.flipped)
  }

  render() {
    return html`
      <div class="scene" aria-live="polite">
        <div class="face front"><slot name="front"></slot></div>
        <div class="face back"><slot name="back"></slot></div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-flip-card': MotionFlipCard
  }
}
