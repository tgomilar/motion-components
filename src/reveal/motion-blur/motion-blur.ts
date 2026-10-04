import { LitElement, html, css } from 'lit'
import { property } from 'lit/decorators.js'
import { scroll } from 'motion'
import { Controllable, PlaybackController } from '../../utils/playback.js'
import type { MotionBlurProps, BlurDirection } from './motion-blur.types.js'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'

export type { MotionBlurProps, BlurDirection } from './motion-blur.types.js'

/**
 * Scroll-driven blur reveal. Maps the element's scroll progress through the
 * viewport to opacity, blur, and Y-translation. Direction controls whether the
 * blur happens on entry, exit, or both.
 *
 * **Use it for:** hero images, quotes and section headings that should come
 * into focus, or fade away, as the page scrolls.
 *
 * **Avoid it for:** an entrance that should play on its own once the content
 * is in view; use `motion-blur-in`, which plays over a fixed time. Avoid
 * `direction="both"` for text people need to read, because the text is fully
 * clear only when it is in the middle of the screen.
 *
 * **Accessibility:** the content stays in the page while it is faded or
 * blurred, so screen readers can read it at any scroll position. Only
 * opacity, filter and transform change, so the layout does not shift.
 *
 * **Reduced motion:** the content shows fully visible, sharp and in place at
 * once, for every `direction`, and it does not change as the page scrolls.
 * No run starts, so `motion-start` and `motion-finish` do not fire.
 *
 * **Common mistakes:** placing it near the end of the page, or on a page too
 * short to scroll. With `direction="in"`, the content is fully clear only
 * when its center reaches the middle of the screen, so it can stay faded and
 * blurred. Use `motion-blur-in` there.
 *
 * @element motion-blur
 *
 * @fires motion-start - When a run starts.
 * @fires motion-finish - When a run finishes, or `finish()` jumps to the end.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
 *
 * @slot - The content to blur on scroll.
 *
 * @example
 * ```html
 * <motion-blur intensity="14" y="20" direction="in">
 *   <img src="hero.jpg" alt="" />
 * </motion-blur>
 * ```
 */
@customElement('motion-blur')
export class MotionBlur extends Controllable(LitElement) implements MotionBlurProps {
  /** Maximum blur amount in pixels at the unfocused extreme. */
  @property({ type: Number }) intensity = 10
  /** Vertical translation in pixels at the unfocused extreme. */
  @property({ type: Number }) y = 12
  /** When `true` (and `direction="in"`), latch focused state on first reveal. Set `once="false"` to turn it off. */
  @property({ type: Boolean, converter: flag }) once = true
  /** `'in'` blurs on entry, `'out'` blurs on exit, `'both'` blur-focus-blur. */
  @property({ type: String, reflect: true }) direction: BlurDirection = 'in'

  static styles = css`
    :host {
      display: block;
    }
  `

  private cleanup: (() => void) | null = null
  private latched = false

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  playback: PlaybackController = new PlaybackController(this, {
    start: () => {
      this.latched = false
      this.bind()
      return {
        handle: {
          pause: () => this.unbind(),
          resume: () => this.bind(),
          finish: () => {
            this.unbind()
            this.applyEnd()
          },
          cancel: () => this.unbind(),
        },
      }
    },
    applyFinalState: () => this.applyEnd(),
    applyInitialState: () => {
      this.style.opacity = this.direction === 'out' ? '' : '0'
      this.style.filter = ''
      this.style.transform = ''
    },
  })

  connectedCallback() {
    super.connectedCallback()
    // Set initial hidden state before first paint to avoid flash
    if (this.direction !== 'out' && !this.reduced) {
      this.style.opacity = '0'
    }
  }

  firstUpdated() {
    if (this.reduced) {
      this.style.opacity = '1'
      this.style.filter = ''
      this.style.transform = ''
      return
    }
    void this.play()
  }

  private applyEnd() {
    if (this.direction === 'in') {
      this.style.opacity = '1'
      this.style.filter = ''
      this.style.transform = ''
    } else {
      this.style.opacity = '0'
      this.style.filter = `blur(${this.intensity}px)`
      this.style.transform = `translateY(${-this.y}px)`
    }
  }

  private bind() {
    this.unbind()

    if (this.direction === 'in') {
      this.cleanup = scroll(
        (progress: number) => {
          if (this.latched) return
          const p = Math.max(0, Math.min(1, progress))
          this.style.opacity = String(p)
          this.style.filter = `blur(${this.intensity * (1 - p)}px)`
          this.style.transform = `translateY(${this.y * (1 - p)}px)`
          if (this.once && p >= 1) {
            this.latched = true
            this.finish()
          }
        },
        { target: this, offset: ['start end', 'center center'] },
      )
    } else if (this.direction === 'out') {
      this.cleanup = scroll(
        (progress: number) => {
          const p = Math.max(0, Math.min(1, progress))
          this.style.opacity = String(1 - p)
          this.style.filter = `blur(${this.intensity * p}px)`
          this.style.transform = `translateY(${-this.y * p}px)`
        },
        { target: this, offset: ['center center', 'end start'] },
      )
    } else {
      // direction === 'both': blur in as element enters, blur out as element exits
      this.cleanup = scroll(
        (progress: number) => {
          const p = Math.max(0, Math.min(1, progress))
          // Bell curve: 0 at entry, peaks at 0.5 (element centered), 0 at exit
          const bellP = 1 - Math.abs(p * 2 - 1)
          this.style.opacity = String(bellP)
          this.style.filter = `blur(${this.intensity * (1 - bellP)}px)`
          this.style.transform = `translateY(${this.y * (1 - 2 * p)}px)`
        },
        { target: this, offset: ['start end', 'end start'] },
      )
    }
  }

  private unbind() {
    this.cleanup?.()
    this.cleanup = null
  }

  /** Resets the latch and re-binds the scroll handler. */
  replay() {
    this.latched = false

    if (this.reduced) {
      this.style.opacity = '1'
      this.style.filter = ''
      this.style.transform = ''
      return
    }

    this.cancel()
    void this.play()
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('scroll', { bubbles: true }))
    })
  }

  render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-blur': MotionBlur
  }
}
