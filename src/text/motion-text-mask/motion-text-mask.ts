import { LitElement, html, css } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import { animate } from 'motion'
import { useIntersect } from '../utils/use-intersect.js'
import type { MotionTextMaskProps } from './motion-text-mask.types.js'

export type { MotionTextMaskProps } from './motion-text-mask.types.js'

/**
 * Mask-clip reveal primitive. Clips slotted content behind an `overflow:hidden`
 * boundary and slides it upward into view — the same pattern used inside
 * `motion-headline`, exposed as a composable wrapper.
 *
 * @element motion-text-mask
 *
 * @slot - The text or inline content to reveal under the mask.
 *
 * @example
 * ```html
 * <motion-text-mask duration="1.1">Your headline text</motion-text-mask>
 * ```
 */
@customElement('motion-text-mask')
export class MotionTextMask extends LitElement implements MotionTextMaskProps {
  /** Spring duration of the slide-up reveal, in seconds. */
  @property({ type: Number }) duration = 0.9
  /** Delay before the reveal starts, in seconds. */
  @property({ type: Number }) delay = 0
  /** IntersectionObserver threshold (0–1) at which the reveal triggers. */
  @property({ type: Number }) threshold = 0.2
  /** When `true`, only animate the first time the element enters view. */
  @property({ type: Boolean }) once = true

  static styles = css`
    :host {
      display: inline-block;
      overflow: hidden;
      vertical-align: bottom;
    }
    .inner {
      display: block;
      will-change: transform;
    }
  `

  @query('.inner') private inner!: HTMLElement

  private disconnectIntersect: (() => void) | null = null
  private revealed = false

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  connectedCallback() {
    super.connectedCallback()
  }

  firstUpdated() {
    if (!this.reduced) {
      this.inner.style.transform = 'translateY(110%)'
    }

    this.disconnectIntersect = useIntersect(this, this.threshold, () => {
      if (!this.revealed) {
        this.play()
        if (this.once) {
          this.revealed = true
          this.disconnectIntersect?.()
        }
      }
    })
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.disconnectIntersect?.()
  }

  private play() {
    if (this.reduced) {
      this.inner.style.transform = ''
      return
    }
    animate(
      this.inner,
      { y: ['110%', '0%'] },
      { duration: this.duration, delay: this.delay, type: 'spring', bounce: 0.05 },
    )
  }

  /** Resets the inner mask offset and re-runs the reveal. */
  replay() {
    this.revealed = false
    animate(this.inner, { y: '110%' }, { duration: 0 }).then(() => this.play())
  }

  render() {
    return html`<div class="inner"><slot></slot></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-text-mask': MotionTextMask
  }
}
