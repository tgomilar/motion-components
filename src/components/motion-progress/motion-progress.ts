import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { animate, scroll } from 'motion'
import type { MotionProgressProps, ProgressPosition } from './motion-progress.types.js'

export type { MotionProgressProps, ProgressPosition } from './motion-progress.types.js'

/**
 * Fixed progress bar driven by document or per-element scroll. Spring-eased
 * scaleX transform — settles past the value rather than hard-snapping.
 *
 * @element motion-progress
 *
 * @example
 * ```html
 * <motion-progress color="#60a5fa" thickness="3"></motion-progress>
 * <motion-progress target="#article" position="bottom"></motion-progress>
 * ```
 */
@customElement('motion-progress')
export class MotionProgress extends LitElement implements MotionProgressProps {
  /** `'top'` or `'bottom'` of the viewport. */
  @property({ type: String, reflect: true }) position: ProgressPosition = 'top'
  /** Bar color (any valid CSS color). */
  @property({ type: String, reflect: true }) color = 'var(--color-accent, #2563eb)'
  /** Bar thickness in pixels. */
  @property({ type: Number, reflect: true }) thickness = 3
  /** CSS selector of the scroll target. Defaults to the document. */
  @property({ type: String }) target = ''
  /** Spring bounciness applied to the scaleX response (0 = none). */
  @property({ type: Number }) bounce = 0.15
  /** Spring duration of the scaleX response, in seconds. */
  @property({ type: Number }) duration = 0.4

  static styles = css`
    :host {
      display: contents;
    }
    .bar {
      position: fixed;
      left: 0;
      right: 0;
      transform-origin: 0 50%;
      transform: scaleX(0);
      will-change: transform;
      z-index: 9999;
      pointer-events: none;
    }
  `

  private bar: HTMLDivElement | null = null
  private cleanup: (() => void) | null = null

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  firstUpdated() {
    this.bar = this.renderRoot.querySelector('.bar')
    this.apply()
    this.bind()
  }

  updated() {
    this.apply()
    this.cleanup?.()
    this.bind()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.cleanup?.()
    this.cleanup = null
  }

  private apply() {
    if (!this.bar) return
    this.bar.style.background = this.color
    this.bar.style.height = `${this.thickness}px`
    this.bar.style.top = this.position === 'top' ? '0' : 'auto'
    this.bar.style.bottom = this.position === 'bottom' ? '0' : 'auto'
  }

  private bind() {
    if (!this.bar) return
    const target = this.target ? document.querySelector(this.target) : null
    const controls = animate(
      this.bar,
      { scaleX: [0, 1] },
      this.reduced
        ? { duration: 0 }
        : { type: 'spring', bounce: this.bounce, duration: this.duration },
    )
    this.cleanup = scroll(controls, target ? { target: target as Element } : undefined)
  }

  render() {
    return html`<div class="bar" role="progressbar" aria-label="Reading progress"></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-progress': MotionProgress
  }
}
