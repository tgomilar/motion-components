import { LitElement, html, css } from 'lit'
import { property, state } from 'lit/decorators.js'
import { animate } from 'motion'
import type { MotionFlipCardProps, FlipTrigger, FlipAxis } from './motion-flip-card.types.js'
import { customElement } from '../../utils/define.js'

export type { MotionFlipCardProps, FlipTrigger, FlipAxis } from './motion-flip-card.types.js'

/**
 * Two-sided card that flips between a `front` and `back` slot with spring
 * physics. Trigger on hover or click; choose the rotation axis.
 *
 * **Use it for:** a short teaser on the front with a few lines of detail on
 * the back, such as a team member card or a flash card.
 *
 * **Avoid it for:** information that people must not miss, because the back
 * stays hidden until the card flips. For a simple lift on hover, use
 * `motion-hover`.
 *
 * **Accessibility:** with `trigger="click"` the card gets `role="button"` and
 * `tabindex="0"`, and Enter or Space flips it. With the default
 * `trigger="hover"` it reacts only to the pointer, so keyboard users cannot
 * flip it. Both faces stay in the page, so screen readers read the front and
 * the back at any time. The card does not report whether it is flipped.
 *
 * **Reduced motion:** the card shows the other face at once, with no
 * rotation.
 *
 * **Common mistakes:** leaving the card without a size; both faces are
 * positioned on top of each other, so the card has no height of its own. Set
 * a CSS width and height on `motion-flip-card`. Putting links or buttons
 * inside a `trigger="click"` card; they sit inside a button, and a click on
 * them also flips the card.
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

  connectedCallback() {
    super.connectedCallback()
    this.addEventListener('pointerenter', this.onEnter)
    this.addEventListener('pointerleave', this.onLeave)
    this.addEventListener('click', this.onClick)
    this.addEventListener('keydown', this.onKey)
  }

  firstUpdated() {
    this.scene = this.renderRoot.querySelector('.scene')
    this.style.perspective = `${this.perspective}px`
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
    if (changed.has('trigger')) this.syncTrigger(changed.get('trigger'))
  }

  private syncTrigger(previous: unknown) {
    if (this.trigger === 'click') {
      this.setAttribute('tabindex', '0')
      this.setAttribute('role', 'button')
    } else if (previous === 'click') {
      this.removeAttribute('tabindex')
      this.removeAttribute('role')
    }
  }

  private onEnter = () => {
    if (this.trigger === 'hover') this.applyFlip(true)
  }
  private onLeave = () => {
    if (this.trigger === 'hover') this.applyFlip(false)
  }
  private onClick = () => {
    if (this.trigger === 'click') this.applyFlip(!this.flipped)
  }
  private onKey = (e: KeyboardEvent) => {
    if (this.trigger !== 'click' || (e.key !== ' ' && e.key !== 'Enter')) return
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
      <div class="scene">
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
