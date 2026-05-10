import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { animate } from 'motion'

type Keyframes = Parameters<typeof animate>[1]
import type { MotionGlitchProps, GlitchTrigger } from './motion-glitch.types.js'

export type { MotionGlitchProps, GlitchTrigger } from './motion-glitch.types.js'

/**
 * RGB-split glitch effect on text. Renders red and cyan duplicate layers
 * that jitter on hover, an automatic loop, or a single auto-play.
 *
 * @element motion-glitch
 *
 * @slot - The text to glitch. Plain text only — markup inside is replaced.
 *
 * @example
 * ```html
 * <motion-glitch trigger="loop" intensity="6" interval="2500">
 *   ERROR_404
 * </motion-glitch>
 * ```
 */
@customElement('motion-glitch')
export class MotionGlitch extends LitElement implements MotionGlitchProps {
  /** Maximum horizontal displacement of the RGB layers, in pixels. */
  @property({ type: Number }) intensity = 5
  /** When the glitch fires: `'hover'`, `'auto'` (once on mount), or `'loop'`. */
  @property({ type: String, reflect: true }) trigger: GlitchTrigger = 'loop'
  /** Time between glitch bursts when `trigger="loop"`, in milliseconds. */
  @property({ type: Number }) interval = 2000

  static styles = css`
    :host {
      display: inline-block;
    }
  `

  private main: HTMLElement | null = null
  private r: HTMLElement | null = null
  private b: HTMLElement | null = null
  private loopId: ReturnType<typeof setInterval> | null = null

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  firstUpdated() {
    const text = this.textContent?.trim() ?? ''
    if (!text) return

    this.innerHTML = `<span style="position:relative;display:inline-block">\
<span data-mg-main style="display:block">${text}</span>\
<span data-mg-r aria-hidden="true" style="position:absolute;inset:0;display:block;color:#ff0040;opacity:0;pointer-events:none">${text}</span>\
<span data-mg-b aria-hidden="true" style="position:absolute;inset:0;display:block;color:#00e5ff;opacity:0;pointer-events:none">${text}</span>\
</span>`

    this.main = this.querySelector('[data-mg-main]')
    this.r = this.querySelector('[data-mg-r]')
    this.b = this.querySelector('[data-mg-b]')

    if (this.trigger === 'hover') {
      this.addEventListener('mouseenter', this.runGlitch)
    } else if (this.trigger === 'auto') {
      this.runGlitch()
    } else if (this.trigger === 'loop') {
      this.runGlitch()
      this.loopId = setInterval(this.runGlitch, this.interval)
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    if (this.loopId !== null) clearInterval(this.loopId)
  }

  private runGlitch = () => {
    if (this.reduced) return
    const { main, r, b } = this
    if (!main || !r || !b) return

    const i = this.intensity
    const d = 0.38

    animate(
      r,
      {
        x: [0, i * 1.4, -i * 0.9, i * 2, -i * 1.1, 0],
        opacity: [0, 0.9, 0.65, 0.95, 0.75, 0],
      } as Keyframes,
      { duration: d, ease: 'linear' },
    )
    animate(
      b,
      {
        x: [0, -i * 1.0, i * 1.6, -i * 1.3, i * 0.7, 0],
        opacity: [0, 0.8, 0.95, 0.6, 0.85, 0],
      } as Keyframes,
      { duration: d, ease: 'linear' },
    )
    animate(main, { x: [0, -i * 0.3, i * 0.5, -i * 0.25, 0] } as Keyframes, {
      duration: d * 0.65,
      ease: 'linear',
    })
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
