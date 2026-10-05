import { LitElement, html, css } from 'lit'
import { property, state } from 'lit/decorators.js'
import { animate } from 'motion'
import type { AnimationPlaybackControls } from 'motion'
import { Controllable, PlaybackController } from '../../utils/playback.js'
import { pauseOnHover } from '../utils/loop.js'
import type { LoopProps } from '../utils/loop.js'
import type { MotionTypewriterProps } from './motion-typewriter.types.js'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'

export type { MotionTypewriterProps } from './motion-typewriter.types.js'

/**
 * Typewriter text effect. Reveals slotted text character-by-character,
 * with optional looping (type → hold → erase → retype) and a blinking caret.
 *
 * **Use it for:** a short line, such as a hero tagline or a prompt, that
 * should type itself out when it scrolls into view, once or on repeat with
 * `loop`.
 *
 * **Avoid it for:** long text, important information and text with links or
 * other markup, which is removed. For words that take turns in one place,
 * use `motion-words`.
 *
 * **Accessibility:** screen readers read the whole text at all times from a
 * visually hidden copy, even before typing starts and while `loop` erases it.
 * The typed characters and the caret are `aria-hidden`.
 *
 * **Reduced motion:** the full text shows at once and nothing is typed. The
 * caret shows but does not blink; set `cursor="false"` to hide it.
 *
 * **Common mistakes:** waiting for `motion-finish` or `finished` with `loop`
 * set: a looping run never finishes on its own. Forgetting that the element
 * is empty until it types: the content after it moves as the line grows, so
 * reserve the space in your layout.
 *
 * @element motion-typewriter
 *
 * @fires motion-start - When a run starts.
 * @fires motion-finish - When a run finishes, or `finish()` jumps to the end.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
 *
 * @slot - The text to type. Plain text only — read once on connect.
 *
 * @example
 * ```html
 * <motion-typewriter interval="0.04" loop hold="2">
 *   Hello, world.
 * </motion-typewriter>
 * ```
 */
@customElement('motion-typewriter')
export class MotionTypewriter
  extends Controllable(LitElement)
  implements MotionTypewriterProps, LoopProps
{
  /** Time between characters while typing, in seconds. */
  @property({ type: Number }) interval = 0.05
  /** Delay before typing starts after viewport entry, in seconds. */
  @property({ type: Number }) delay = 0
  /** Time to hold the finished line before erasing (loop mode), in seconds. */
  @property({ type: Number }) hold = 1.8
  /** When `true`, type → hold → erase → retype on repeat. */
  @property({ type: Boolean, converter: flag }) loop = false
  /** With `loop`, seconds the line stays empty after erasing before it retypes. */
  @property({ type: Number }) gap = 0.5
  /** Pause the loop while the pointer is over the text. */
  @property({ type: Boolean, converter: flag, attribute: 'pause-on-hover' }) pauseOnHover = false
  /** When `true`, render a blinking caret after the typed text. Set `cursor="false"` to hide it. */
  @property({ type: Boolean, converter: flag }) cursor = true

  @state() private displayed = ''

  static styles = css`
    :host {
      display: inline;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    .cursor {
      display: inline-block;
      width: 2px;
      height: 1.1em;
      background: currentColor;
      margin-left: 2px;
      vertical-align: text-bottom;
    }
  `

  private full = ''
  private timer: ReturnType<typeof setTimeout> | null = null
  private index = 0
  private observer: IntersectionObserver | null = null
  private pendingStep: (() => void) | null = null
  private nextFireAt = 0
  private remaining = 0
  private resolveRun: (() => void) | null = null
  private blink: AnimationPlaybackControls | null = null
  private detachPauseOnHover: (() => void) | null = null

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  playback: PlaybackController = new PlaybackController(this, {
    start: () => {
      this.index = 0
      this.displayed = ''
      const done = this.loop
        ? undefined
        : new Promise<void>((resolve) => {
            this.resolveRun = resolve
          })
      this.schedule(() => this.type(), this.delay * 1000)
      return {
        handle: {
          pause: () => {
            if (this.timer) clearTimeout(this.timer)
            this.timer = null
            this.remaining = Math.max(0, this.nextFireAt - performance.now())
          },
          resume: () => {
            if (this.pendingStep) this.schedule(this.pendingStep, this.remaining)
          },
          finish: () => {
            this.stopTimer()
            this.applyTyped()
          },
          cancel: () => this.stopTimer(),
        },
        done,
      }
    },
    applyFinalState: () => this.applyTyped(),
    applyInitialState: () => {
      this.index = 0
      this.displayed = ''
    },
  })

  connectedCallback() {
    // eslint-disable-next-line wc/no-child-traversal-in-connectedcallback
    this.full = this.textContent?.trim() || this.full
    this.textContent = ''
    super.connectedCallback()
    if (this.reduced) {
      this.displayed = this.full
      return
    }
    this.observer = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          this.observer?.disconnect()
          if (this.playState === 'idle') void this.play()
        }
      },
      { threshold: 0.2 },
    )
    this.observer.observe(this)
    this.detachPauseOnHover = pauseOnHover(
      this,
      () => this.loop && this.pauseOnHover,
      () => this.pause(),
      () => this.play(),
    )
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.observer?.disconnect()
    this.detachPauseOnHover?.()
    this.detachPauseOnHover = null
    this.stopTimer()
    this.stopBlink()
  }

  protected updated() {
    const caret = this.renderRoot.querySelector<HTMLElement>('.cursor')
    if (!caret) this.stopBlink()
    else if (!this.blink && !this.reduced) {
      this.blink = animate(
        caret,
        { opacity: [1, 0] },
        { duration: 0.5, repeat: Infinity, repeatType: 'reverse' },
      )
    }
  }

  private stopBlink() {
    this.blink?.stop()
    this.blink = null
  }

  private schedule(step: () => void, ms: number) {
    this.pendingStep = step
    this.nextFireAt = performance.now() + ms
    this.timer = setTimeout(step, ms)
  }

  private stopTimer() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.pendingStep = null
  }

  private applyTyped() {
    this.index = this.full.length + 1
    this.displayed = this.full
    this.resolveRun = null
  }

  private type() {
    if (this.index > this.full.length) {
      if (this.loop) {
        this.schedule(() => this.erase(), this.hold * 1000)
      } else {
        this.stopTimer()
        this.resolveRun?.()
        this.resolveRun = null
      }
      return
    }
    this.displayed = this.full.slice(0, this.index)
    this.index++
    this.schedule(() => this.type(), this.interval * 1000)
  }

  private erase() {
    if (this.index <= 0) {
      this.schedule(() => this.type(), this.gap * 1000)
      return
    }
    this.index--
    this.displayed = this.full.slice(0, this.index)
    this.schedule(() => this.erase(), this.interval * 500)
  }

  /** Resets and re-runs the typing animation from the start. */
  replay() {
    this.cancel()
    void this.play()
  }

  render() {
    return html`<span class="sr-only">${this.full}</span
      ><span aria-hidden="true"
        >${this.displayed}${this.cursor ? html`<span class="cursor"></span>` : ''}</span
      >`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-typewriter': MotionTypewriter
  }
}
