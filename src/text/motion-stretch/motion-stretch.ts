import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { animate } from 'motion'
import type { AnimationPlaybackControls } from 'motion'
import type { MotionStretchProps } from './motion-stretch.types.js'

export type { MotionStretchProps } from './motion-stretch.types.js'

/**
 * Springy character spread on hover. Each character springs outward from
 * the centre by `spread`, snapping back on mouse leave.
 *
 * @element motion-stretch
 *
 * @example
 * ```html
 * <motion-stretch text="STRETCH" spread="16"></motion-stretch>
 * ```
 */
@customElement('motion-stretch')
export class MotionStretch extends LitElement implements MotionStretchProps {
  /** Text to stretch. */
  @property({ type: String }) text = ''
  /** Maximum lateral displacement of edge characters, in pixels. */
  @property({ type: Number }) spread = 12
  /** Spring stiffness controlling reaction speed. */
  @property({ type: Number }) stiffness = 320
  /** Spring damping controlling overshoot (lower = more bouncy). */
  @property({ type: Number }) damping = 16

  static styles = css`
    :host {
      display: inline-block;
      font-size: inherit;
      font-weight: inherit;
      font-family: inherit;
      font-style: inherit;
      line-height: inherit;
      cursor: default;
    }

    .track {
      display: inline-flex;
    }

    .char {
      display: inline-block;
      white-space: pre;
      will-change: transform;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `

  private controls: AnimationPlaybackControls[] = []

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
    this.stopAll()
    this.removeEventListener('mouseenter', this.onEnter)
    this.removeEventListener('mouseleave', this.onLeave)
  }

  private stopAll() {
    this.controls.forEach((c) => c.stop())
    this.controls = []
  }

  private onEnter = () => {
    if (this.reduced) return
    this.stopAll()
    const chars = Array.from(this.shadowRoot!.querySelectorAll<HTMLElement>('.char'))
    const n = chars.length
    const spring = { type: 'spring' as const, stiffness: this.stiffness, damping: this.damping }

    this.controls = chars.map((char, i) => {
      const t = n > 1 ? i / (n - 1) - 0.5 : 0 // -0.5 to 0.5
      const targetX = t * this.spread * 2
      return animate(char, { x: targetX }, spring)
    })
  }

  private onLeave = () => {
    this.stopAll()
    const chars = Array.from(this.shadowRoot!.querySelectorAll<HTMLElement>('.char'))
    if (this.reduced) {
      chars.forEach((char) => animate(char, { x: 0 }, { duration: 0 }))
      return
    }
    const spring = { type: 'spring' as const, stiffness: this.stiffness, damping: this.damping }
    this.controls = chars.map((char) => animate(char, { x: 0 }, spring))
  }

  render() {
    return html`
      <span class="sr-only">${this.text}</span>
      <span class="track" aria-hidden="true">
        ${[...this.text].map(
          (char) => html`<span class="char">${char === ' ' ? '\u00A0' : char}</span>`,
        )}
      </span>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-stretch': MotionStretch
  }
}
