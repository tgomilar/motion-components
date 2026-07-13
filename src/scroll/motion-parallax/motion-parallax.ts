import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { animate, scroll } from 'motion'
import type { AnimationPlaybackControls } from 'motion'
import { Controllable, PlaybackController } from '../../utils/playback.js'
import type { MotionParallaxProps } from './motion-parallax.types.js'

export type { MotionParallaxProps } from './motion-parallax.types.js'

/**
 * Lightweight parallax scroll primitive. Moves the slotted content along the
 * chosen axis at a configurable speed relative to the scroll position.
 *
 * @element motion-parallax
 *
 * @slot - The content that parallax-scrolls.
 *
 * @example
 * ```html
 * <motion-parallax speed="0.3" axis="y">
 *   <img src="background.jpg" alt="" />
 * </motion-parallax>
 * ```
 */
@customElement('motion-parallax')
export class MotionParallax extends Controllable(LitElement) implements MotionParallaxProps {
  /** Parallax intensity. `0` = no movement (scrolls with page), `1` = strong drift. */
  @property({ type: Number }) speed = 0.5
  /** Scroll axis: `'x'` for horizontal, `'y'` for vertical. */
  @property({ type: String }) axis: 'x' | 'y' = 'y'
  /** CSS selector for a custom scroll container element (defaults to the document). */
  @property({ type: String }) container = ''

  static styles = css`
    :host {
      display: block;
      will-change: transform;
    }
  `

  private controls: AnimationPlaybackControls | null = null
  private cleanup: (() => void) | null = null

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  playback: PlaybackController = new PlaybackController(this, {
    start: () => {
      this.bind()
      return {
        handle: {
          pause: () => this.unbind(),
          resume: () => this.bind(),
          finish: () => {
            this.release()
            this.applyEnd()
          },
          cancel: () => this.release(),
        },
      }
    },
    applyFinalState: () => this.applyEnd(),
    applyInitialState: () => {
      this.style.transform = ''
    },
  })

  firstUpdated() {
    if (this.reduced) return
    void this.play()
  }

  updated(changed: Map<string, unknown>) {
    if (
      (changed.has('speed') || changed.has('axis') || changed.has('container')) &&
      this.playState === 'running'
    ) {
      this.unbind()
      this.bind()
    }
  }

  private resolveContainer(): HTMLElement | undefined {
    if (!this.container) return undefined
    return document.querySelector<HTMLElement>(this.container) ?? undefined
  }

  private bind() {
    this.release()
    const factor = this.speed
    const range = 80 // px

    const keyframes =
      this.axis === 'x'
        ? { x: [`${factor * range}px`, `${-(factor * range)}px`] }
        : { y: [`${factor * range}px`, `${-(factor * range)}px`] }

    this.controls = animate(this, keyframes, { ease: 'linear' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scrollOptions: any = { target: this, offset: ['start end', 'end start'] }
    const source = this.resolveContainer()
    if (source) scrollOptions.container = source
    this.cleanup = scroll(this.controls, scrollOptions)
  }

  private unbind() {
    this.cleanup?.()
    this.cleanup = null
  }

  private release() {
    this.unbind()
    // stop(), not cancel(): cancel() re-renders the first keyframe on the next
    // frame, clobbering the applyEnd/applyInitialState styles written after it
    this.controls?.stop()
    this.controls = null
  }

  private applyEnd() {
    const offset = -(this.speed * 80)
    this.style.transform = this.axis === 'x' ? `translateX(${offset}px)` : `translateY(${offset}px)`
  }

  render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-parallax': MotionParallax
  }
}
