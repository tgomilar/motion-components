import { LitElement, html, css } from 'lit'
import { property } from 'lit/decorators.js'
import { animate, scroll } from 'motion'
import type { AnimationPlaybackControls } from 'motion'
import { Controllable, PlaybackController } from '../../utils/playback.js'
import type { MotionProgressProps, ProgressPosition } from './motion-progress.types.js'
import { customElement } from '../../utils/define.js'

export type { MotionProgressProps, ProgressPosition } from './motion-progress.types.js'

/**
 * Fixed progress bar driven by document or per-element scroll. Spring-eased
 * scaleX transform — settles past the value rather than hard-snapping.
 *
 * **Use it for:** a thin reading progress bar at the top or bottom of the
 * window on long articles and documentation pages.
 *
 * **Avoid it for:** the progress of a task such as an upload; it only follows
 * scrolling and has no value you can set. Use the native `<progress>` element
 * for that.
 *
 * **Accessibility:** the bar is decoration only, so it has
 * `aria-hidden="true"` and screen readers skip it. Screen reader users follow
 * their own reading position, not the scroll position. The bar never takes
 * focus and ignores the pointer.
 *
 * **Reduced motion:** the bar still follows scrolling, but without the
 * spring. Its width matches the scroll position exactly.
 *
 * **Common mistakes:** pointing `target` at a box that scrolls on its own; the
 * bar measures how that element moves through the window, not scrolling
 * inside it. Setting `target` to an element that is not in the page yet when
 * the bar starts; the bar then follows the whole document instead.
 *
 * @element motion-progress
 *
 * @fires motion-start - When a run starts.
 * @fires motion-finish - When a run finishes, or `finish()` jumps to the end.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
 *
 * @cssprop --mc-progress-color - Bar color. Default `var(--mc-color-accent, #2563eb)`.
 *
 * @example
 * ```html
 * <motion-progress thickness="3" style="--mc-progress-color: #60a5fa"></motion-progress>
 * <motion-progress target="#article" position="bottom"></motion-progress>
 * ```
 */
@customElement('motion-progress')
export class MotionProgress extends Controllable(LitElement) implements MotionProgressProps {
  /** `'top'` or `'bottom'` of the viewport. */
  @property({ type: String, reflect: true }) position: ProgressPosition = 'top'
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
  private controls: AnimationPlaybackControls | null = null
  private cleanup: (() => void) | null = null

  playback: PlaybackController = new PlaybackController(this, {
    start: () => {
      this.bind()
      return {
        handle: {
          pause: () => this.unbind(),
          resume: () => this.bind(),
          finish: () => {
            this.release()
            this.setScale(1)
          },
          cancel: () => this.release(),
        },
      }
    },
    applyFinalState: () => (this.reduced ? this.bind() : this.setScale(1)),
    applyInitialState: () => {
      this.release()
      this.setScale(0)
    },
  })

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  firstUpdated() {
    this.bar = this.renderRoot.querySelector('.bar')
    this.apply()
    void this.play()
  }

  updated() {
    this.apply()
    if (this.cleanup) this.bind()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.release()
  }

  private apply() {
    if (!this.bar) return
    this.bar.style.background = 'var(--mc-progress-color, var(--mc-color-accent, #2563eb))'
    this.bar.style.height = `${this.thickness}px`
    this.bar.style.top = this.position === 'top' ? '0' : 'auto'
    this.bar.style.bottom = this.position === 'bottom' ? '0' : 'auto'
  }

  private bind() {
    if (!this.bar) return
    this.release()
    const target = this.target ? document.querySelector(this.target) : null
    const options = target ? { target } : undefined
    if (this.reduced) {
      this.cleanup = scroll((progress: number) => this.setScale(progress), options)
      return
    }
    this.controls = animate(
      this.bar,
      { scaleX: [0, 1] },
      { type: 'spring', bounce: this.bounce, duration: this.duration },
    )
    this.cleanup = scroll(this.controls, options)
  }

  private unbind() {
    this.cleanup?.()
    this.cleanup = null
  }

  private release() {
    this.unbind()
    this.controls?.cancel()
    this.controls = null
  }

  private setScale(value: number) {
    if (this.bar) this.bar.style.transform = `scaleX(${value})`
  }

  render() {
    return html`<div class="bar" aria-hidden="true"></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-progress': MotionProgress
  }
}
