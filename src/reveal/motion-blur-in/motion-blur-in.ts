import { LitElement, html, css } from 'lit'
import { property } from 'lit/decorators.js'
import { animate } from 'motion'
import { Controllable, PlaybackController, controlsRun } from '../../utils/playback.js'
import type { MotionBlurInProps } from './motion-blur-in.types.js'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'

export type { MotionBlurInProps } from './motion-blur-in.types.js'

/**
 * Viewport-triggered blur reveal. Starts blurred and translated, snaps to
 * focus once the element enters the viewport. The dominant editorial
 * entrance pattern of 2024–2025.
 *
 * **Use it for:** headlines, hero text and images that should come into
 * focus with a short animation the first time they scroll into view.
 *
 * **Avoid it for:** effects that should follow the scroll position; use
 * `motion-blur`. For a list of items, use `motion-stagger`. For a fade
 * without blur, use `motion-reveal`.
 *
 * **Accessibility:** the content stays in the page while it is hidden and
 * blurred, so screen readers read it before it animates. Only opacity, filter
 * and transform change, so the layout does not shift.
 *
 * **Reduced motion:** the content is never hidden or blurred. It shows at its
 * final position at once, with no animation. The `motion-start` and
 * `motion-finish` events still fire when it enters the view.
 *
 * **Common mistakes:** wrapping a whole page section in one `motion-blur-in`,
 * so nothing shows until 10% of it is in view; wrap each block instead, or
 * lower `threshold`. Changing `threshold` after the element has rendered has
 * no effect, because it is read only once.
 *
 * @element motion-blur-in
 *
 * @fires motion-start - When a run starts.
 * @fires motion-finish - When a run finishes, or `finish()` jumps to the end.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
 *
 * @slot - The content to blur-reveal.
 *
 * @example
 * ```html
 * <motion-blur-in intensity="12" y="8" duration="0.7">
 *   <h1>Headline</h1>
 * </motion-blur-in>
 * ```
 */
@customElement('motion-blur-in')
export class MotionBlurIn extends Controllable(LitElement) implements MotionBlurInProps {
  /** Spring duration of the reveal animation, in seconds. */
  @property({ type: Number }) duration = 0.7
  /** Initial blur in pixels; animates to 0 on reveal. */
  @property({ type: Number }) intensity = 10
  /** Initial vertical offset in pixels; animates to 0 on reveal. */
  @property({ type: Number }) y = 12
  /** IntersectionObserver threshold (0–1) at which the reveal triggers. */
  @property({ type: Number }) threshold = 0.1
  /** When `true`, only animate the first time the element enters view. Set `once="false"` to turn it off. */
  @property({ type: Boolean, converter: flag }) once = true

  static styles = css`
    :host {
      display: block;
    }
  `

  private observer: IntersectionObserver | null = null
  private revealed = false

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  playback: PlaybackController = new PlaybackController(this, {
    start: () =>
      controlsRun(
        animate(
          this,
          {
            opacity: [0, 1],
            filter: [`blur(${this.intensity}px)`, 'blur(0px)'],
            y: [this.y, 0],
          },
          { duration: this.duration, type: 'spring', bounce: 0.1 },
        ),
      ),
    applyFinalState: () => {
      this.style.opacity = '1'
      this.style.filter = ''
      this.style.transform = ''
    },
    applyInitialState: () => {
      this.style.opacity = '0'
      this.style.filter = `blur(${this.intensity}px)`
      this.style.transform = ''
    },
  })

  connectedCallback() {
    super.connectedCallback()
    if (!this.reduced) {
      this.style.opacity = '0'
    }
  }

  firstUpdated() {
    if (!this.reduced) {
      this.style.filter = `blur(${this.intensity}px)`
    }

    this.observer = new IntersectionObserver(this.onIntersect, { threshold: this.threshold })
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
      } else if (!entry.isIntersecting) {
        if (!this.once && this.playState !== 'idle') this.cancel()
      }
    }
  }

  /** Resets to the blurred initial state and re-runs the reveal. */
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
    'motion-blur-in': MotionBlurIn
  }
}
