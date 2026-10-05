import { LitElement, html, css } from 'lit'
import { property } from 'lit/decorators.js'
import { animate } from 'motion'
import type { AnimationPlaybackControls } from 'motion'
import { Controllable, PlaybackController } from '../../utils/playback.js'
import { customElement } from '../../utils/define.js'
import { escapeHtml } from '../utils/split-text.js'

type Keyframes = Parameters<typeof animate>[1]
import type { MotionGlitchProps, GlitchTrigger } from './motion-glitch.types.js'

export type { MotionGlitchProps, GlitchTrigger } from './motion-glitch.types.js'

/**
 * RGB-split glitch effect on text. Renders red and cyan duplicate layers
 * that jitter on hover, an automatic loop, or a single auto-play.
 *
 * **Use it for:** short labels with a technical or error look, such as
 * `ERROR_404` or a game title.
 *
 * **Avoid it for:** long text, body copy and text with markup. For text that
 * decodes through random letters, use `motion-scramble`.
 *
 * **Accessibility:** the original text stays as real text and is read as
 * normal. The red and cyan copies are `aria-hidden`. `trigger="hover"` reacts
 * to the mouse only, not to keyboard focus. With `trigger="loop"`, the bursts
 * never stop on their own; if people must be able to stop them, add a button
 * that calls `pause()`.
 *
 * **Reduced motion:** no glitch bursts run, with any `trigger` and with
 * `glitch()`. The text stays still.
 *
 * **Common mistakes:** putting a link or other markup inside. Only the plain
 * text is kept, so put the `motion-glitch` inside the link instead. Changing
 * `trigger` after the element first renders has no effect.
 *
 * @element motion-glitch
 *
 * @fires motion-start - When a run starts.
 * @fires motion-finish - When a run finishes, or `finish()` jumps to the end.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
 *
 * @slot - The text to glitch. Plain text only — markup inside is replaced.
 *
 * @example
 * ```html
 * <motion-glitch trigger="loop" intensity="6" interval="2.5">
 *   ERROR_404
 * </motion-glitch>
 * ```
 */
@customElement('motion-glitch')
export class MotionGlitch extends Controllable(LitElement) implements MotionGlitchProps {
  /** Maximum horizontal displacement of the RGB layers, in pixels. */
  @property({ type: Number }) intensity = 5
  /** When the glitch fires: `'hover'`, `'mount'` (once on load), or `'loop'` (keep firing). This is a trigger mode, not the boolean `loop` other components use. */
  @property({ type: String, reflect: true }) trigger: GlitchTrigger = 'loop'
  /** Time between glitch bursts when `trigger="loop"`, in seconds. */
  @property({ type: Number }) interval = 2

  static styles = css`
    :host {
      display: inline-block;
    }
  `

  private main: HTMLElement | null = null
  private r: HTMLElement | null = null
  private b: HTMLElement | null = null
  private loopId: ReturnType<typeof setTimeout> | null = null
  private nextFireAt = 0
  private remaining = 0
  private bursts: AnimationPlaybackControls[] = []

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  playback: PlaybackController = new PlaybackController(this, {
    start: () => {
      this.runGlitch()
      this.schedule(this.interval * 1000)
      return {
        handle: {
          pause: () => {
            this.remaining = Math.max(0, this.nextFireAt - performance.now())
            this.stopLoop()
          },
          resume: () => this.schedule(this.remaining),
          finish: () => {
            this.stopLoop()
            this.settleBursts('complete')
          },
          cancel: () => {
            this.stopLoop()
            this.settleBursts('cancel')
          },
        },
      }
    },
    applyFinalState: () => this.settleBursts('complete'),
    applyInitialState: () => this.settleBursts('cancel'),
  })

  firstUpdated() {
    const text = this.textContent?.trim() ?? ''
    if (!text) return
    const safe = escapeHtml(text)

    this.innerHTML = `<span style="position:relative;display:inline-block">\
<span data-mg-main style="display:block">${safe}</span>\
<span data-mg-r aria-hidden="true" style="position:absolute;inset:0;display:block;color:#ff0040;opacity:0;pointer-events:none">${safe}</span>\
<span data-mg-b aria-hidden="true" style="position:absolute;inset:0;display:block;color:#00e5ff;opacity:0;pointer-events:none">${safe}</span>\
</span>`

    this.main = this.querySelector('[data-mg-main]')
    this.r = this.querySelector('[data-mg-r]')
    this.b = this.querySelector('[data-mg-b]')

    if (this.trigger === 'hover') {
      this.addEventListener('mouseenter', this.runGlitch)
    } else if (this.trigger === 'mount') {
      this.runGlitch()
    } else if (this.trigger === 'loop') {
      void this.play()
    }
  }

  private schedule(ms: number) {
    this.nextFireAt = performance.now() + ms
    this.loopId = setTimeout(() => {
      this.runGlitch()
      this.schedule(this.interval * 1000)
    }, ms)
  }

  private stopLoop() {
    if (this.loopId !== null) clearTimeout(this.loopId)
    this.loopId = null
  }

  private settleBursts(method: 'complete' | 'cancel') {
    for (const controls of this.bursts) controls[method]()
    this.bursts = []
  }

  private runGlitch = () => {
    if (this.reduced) return
    const { main, r, b } = this
    if (!main || !r || !b) return

    const i = this.intensity
    const d = 0.38

    this.bursts = [
      animate(
        r,
        {
          x: [0, i * 1.4, -i * 0.9, i * 2, -i * 1.1, 0],
          opacity: [0, 0.9, 0.65, 0.95, 0.75, 0],
        } as Keyframes,
        { duration: d, ease: 'linear' },
      ),
      animate(
        b,
        {
          x: [0, -i * 1.0, i * 1.6, -i * 1.3, i * 0.7, 0],
          opacity: [0, 0.8, 0.95, 0.6, 0.85, 0],
        } as Keyframes,
        { duration: d, ease: 'linear' },
      ),
      animate(main, { x: [0, -i * 0.3, i * 0.5, -i * 0.25, 0] } as Keyframes, {
        duration: d * 0.65,
        ease: 'linear',
      }),
    ]
  }

  /** Triggers a single glitch burst manually. */
  glitch() {
    this.runGlitch()
  }

  render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-glitch': MotionGlitch
  }
}
