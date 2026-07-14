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
 * Text can be set with the `text` attribute or as child text. Child text
 * doubles as a pre-upgrade fallback: the browser shows it before the
 * element is defined, so the page never paints an empty gap.
 *
 * @element motion-stretch
 *
 * @example
 * ```html
 * <motion-stretch spread="16">STRETCH</motion-stretch>
 * ```
 */
@customElement('motion-stretch')
export class MotionStretch extends LitElement implements MotionStretchProps {
  /** Text to stretch. Falls back to the element's child text when unset. */
  @property({ type: String }) text?: string
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
    // eslint-disable-next-line wc/no-child-traversal-in-connectedcallback
    if (!this.text) this.text = this.textContent?.trim() ?? ''
    this.textContent = ''
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
        ${[...(this.text ?? '')].map(
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
