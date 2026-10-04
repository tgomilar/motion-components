import { LitElement, html, css } from 'lit'
import { property } from 'lit/decorators.js'
import { animate, scroll } from 'motion'
import type { AnimationPlaybackControls } from 'motion'
import { Controllable, PlaybackController } from '../../utils/playback.js'
import type { MotionParallaxProps } from './motion-parallax.types.js'
import { customElement } from '../../utils/define.js'

export type { MotionParallaxProps } from './motion-parallax.types.js'

/**
 * Lightweight parallax scroll primitive. Moves the slotted content along the
 * chosen axis by a configurable depth relative to the scroll position.
 *
 * **Use it for:** background images, decorative shapes and layered hero art
 * that should move at a different speed than the page while it scrolls.
 *
 * **Avoid it for:** text and controls people need to read or use. For a
 * pinned scroll sequence, use `motion-scene`. For a one-time entrance, use
 * `motion-reveal`.
 *
 * **Accessibility:** the component adds no roles or aria attributes. The
 * content stays in the page and in reading order. Only `transform` changes,
 * so the layout does not shift. Give decorative images an empty `alt`.
 *
 * **Reduced motion:** the scroll effect does not start, and the content stays
 * at its normal position. If you call `play()`, the content jumps to its end
 * offset and does not follow the scroll.
 *
 * **Common mistakes:** expecting `axis="x"` to follow a sideways scroller:
 * `axis` only sets the direction of movement, and the movement still follows
 * vertical scrolling. A `container` selector that matches nothing falls back
 * to the page scroll without a warning.
 *
 * @element motion-parallax
 *
 * @fires motion-start - When a run starts.
 * @fires motion-finish - When a run finishes, or `finish()` jumps to the end.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
 *
 * @slot - The content that parallax-scrolls.
 *
 * @example
 * ```html
 * <motion-parallax depth="0.3" axis="y">
 *   <img src="background.jpg" alt="" />
 * </motion-parallax>
 * ```
 */
@customElement('motion-parallax')
export class MotionParallax extends Controllable(LitElement) implements MotionParallaxProps {
  /** Parallax intensity. `0` = no movement (scrolls with page), `1` = strong drift. */
  @property({ type: Number }) depth = 0.5
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
      (changed.has('depth') || changed.has('axis') || changed.has('container')) &&
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
    const factor = this.depth
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
    const offset = -(this.depth * 80)
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
