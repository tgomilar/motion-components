import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { animate } from 'motion'
import { REVEAL_SPRING } from '../../utils/springs.js'
import { Controllable, PlaybackController, controlsRun } from '../../utils/playback.js'
import type { MotionRevealProps } from './motion-reveal.types.js'

export type { MotionRevealProps } from './motion-reveal.types.js'

/**
 * Viewport-triggered fade + translate reveal. Starts hidden, animates in
 * with a spring once the element intersects the viewport.
 *
 * @element motion-reveal
 *
 * @slot - The content to reveal on scroll-in.
 *
 * @example
 * ```html
 * <motion-reveal y="40" duration="0.8">
 *   <h2>Reveals when scrolled into view</h2>
 * </motion-reveal>
 * ```
 */
@customElement('motion-reveal')
export class MotionReveal extends Controllable(LitElement) implements MotionRevealProps {
  /** Spring duration of the reveal animation, in seconds. */
  @property({ type: Number }) duration = 0.6
  /** Initial vertical offset in pixels; element rises to 0 on reveal. */
  @property({ type: Number }) y = 24
  /** IntersectionObserver threshold (0–1) at which the reveal triggers. */
  @property({ type: Number }) threshold = 0.1
  /** When `true`, only animate the first time the element enters view. */
  @property({ type: Boolean }) once = true

  static styles = css`
    :host {
      display: block;
    }
  `

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  private observer: IntersectionObserver | null = null
  private revealed = false

  playback: PlaybackController = new PlaybackController(this, {
    start: () =>
      controlsRun(
        animate(
          this,
          { opacity: [0, 1], y: [this.y, 0] },
          { ...REVEAL_SPRING, duration: this.duration },
        ),
      ),
    applyFinalState: () => {
      this.style.opacity = '1'
      this.style.transform = ''
    },
    applyInitialState: () => {
      this.style.opacity = '0'
      this.style.transform = ''
    },
  })

  connectedCallback() {
    this.style.opacity = this.reduced ? '1' : '0'
    super.connectedCallback()
    if (this.reduced) return
    this.observer = new IntersectionObserver(this.onIntersect, {
      threshold: this.threshold,
    })
    this.observer.observe(this)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.observer?.disconnect()
  }

  private onIntersect = (entries: IntersectionObserverEntry[]) => {
    for (const entry of entries) {
      if (entry.isIntersecting && !this.revealed && this.playState === 'idle') {
        void this.play()
        if (this.once) {
          this.revealed = true
          this.observer?.disconnect()
        }
      }
    }
  }

  /** Re-runs the reveal animation from its hidden initial state. */
  replay() {
    this.revealed = false
    this.cancel()
    void this.play()
  }

  render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-reveal': MotionReveal
  }
}
