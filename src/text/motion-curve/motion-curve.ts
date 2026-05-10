import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { animate } from 'motion'
import type { AnimationPlaybackControls } from 'motion'
import type { MotionCurveProps } from './motion-curve.types.js'

export type { MotionCurveProps } from './motion-curve.types.js'

/**
 * Sine-wave text. Each character of `text` rides a travelling wave with a
 * tangent-aligned rotation, producing a flowing serpent effect. With `loop`,
 * the text scrolls horizontally as a marquee while still riding the wave.
 *
 * @element motion-curve
 *
 * @example
 * ```html
 * <motion-curve text="Motion" amplitude="20" speed="0.5"></motion-curve>
 * <motion-curve text="endless" loop loop-speed="60"></motion-curve>
 * ```
 */
@customElement('motion-curve')
export class MotionCurve extends LitElement implements MotionCurveProps {
  /** Text to render along the wave. */
  @property({ type: String }) text = ''
  /** Peak vertical offset of the wave, in pixels. */
  @property({ type: Number }) amplitude = 24
  /** Distance between wave crests, in pixels. */
  @property({ type: Number, attribute: 'wave-length' }) waveLength = 280
  /** Wave travel speed (radians per frame at 60fps). */
  @property({ type: Number }) speed = 0.4
  /** When `true`, scroll the text horizontally as a marquee. */
  @property({ type: Boolean, reflect: true }) loop = false
  /** Scroll speed when `loop` is enabled, in pixels per second. */
  @property({ type: Number, attribute: 'loop-speed' }) loopSpeed = 80
  /** Gap between repeated text sets in loop mode, in pixels. */
  @property({ type: Number, attribute: 'loop-gap' }) loopGap = 48
  /** When `true`, omit vertical padding equal to `amplitude`. */
  @property({ type: Boolean, attribute: 'no-pad' }) noPad = false
  /** When `true`, pause the wave/loop while the cursor is over the element. */
  @property({ type: Boolean, attribute: 'pause-on-hover' }) pauseOnHover = false

  @state() private numSets = 2

  static styles = css`
    :host {
      display: inline-block;
      font-size: inherit;
      font-weight: inherit;
      font-family: inherit;
      font-style: inherit;
      letter-spacing: inherit;
      line-height: inherit;
    }

    :host([loop]) {
      display: block;
      width: 100%;
    }

    .track {
      display: inline-flex;
      will-change: transform;
    }

    .set {
      display: inline-flex;
      flex-shrink: 0;
    }

    .char {
      display: inline-block;
      will-change: transform;
      white-space: pre;
    }
  `

  private xPositions: number[] = []
  private raf: number | null = null
  private loopControls: AnimationPlaybackControls | null = null
  private phase = 0

  connectedCallback() {
    super.connectedCallback()
    this.addEventListener('mouseenter', this.onEnter)
    this.addEventListener('mouseleave', this.onLeave)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    if (this.raf !== null) cancelAnimationFrame(this.raf)
    this.loopControls?.stop()
    this.removeEventListener('mouseenter', this.onEnter)
    this.removeEventListener('mouseleave', this.onLeave)
  }

  private onEnter = () => {
    if (!this.pauseOnHover) return
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf)
      this.raf = null
    }
    this.loopControls?.pause()
  }

  private onLeave = () => {
    if (!this.pauseOnHover) return
    this.loopControls?.play()
    this.startWave()
  }

  updated(changed: Map<string, unknown>) {
    const needsSetup =
      changed.has('text') ||
      changed.has('loop') ||
      changed.has('loopSpeed') ||
      changed.has('speed') ||
      changed.has('amplitude') ||
      changed.has('waveLength') ||
      changed.has('loopGap') ||
      changed.has('noPad') ||
      changed.has('numSets')

    if (needsSetup) this.setup()
  }

  private setup() {
    if (this.raf !== null) cancelAnimationFrame(this.raf)
    this.loopControls?.stop()
    this.loopControls = null

    this.style.paddingTop = this.noPad ? '0' : `${this.amplitude}px`
    this.style.paddingBottom = this.noPad ? '0' : `${this.amplitude}px`

    if (this.loop) {
      this.setupLoop()
    } else {
      if (this.numSets !== 2) this.numSets = 2
      this.measureStatic()
      this.startWave()
    }
  }

  private setupLoop() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const firstSet = this.shadowRoot!.querySelector<HTMLElement>('.set')
    if (!firstSet) return

    const setWidth = firstSet.offsetWidth
    if (!setWidth) {
      requestAnimationFrame(() => this.setupLoop())
      return
    }

    const loopWidth = setWidth + this.loopGap

    const needed = Math.max(2, Math.ceil(this.offsetWidth / loopWidth) + 1)
    if (needed !== this.numSets) {
      this.numSets = needed
      return
    }

    const track = this.shadowRoot!.querySelector<HTMLElement>('.track')!
    this.loopControls = animate(
      track,
      { x: [0, -loopWidth] },
      { duration: loopWidth / this.loopSpeed, repeat: Infinity, ease: 'linear' },
    )

    this.startWave()
  }

  private measureStatic() {
    const spans = Array.from(this.shadowRoot!.querySelectorAll<HTMLElement>('.char'))
    let x = 0
    this.xPositions = spans.map((span) => {
      const pos = x
      x += span.offsetWidth
      return pos
    })
  }

  private startWave() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const k = (2 * Math.PI) / this.waveLength

    const step = () => {
      this.phase += (this.speed * 2 * Math.PI) / 60

      const spans = Array.from(this.shadowRoot!.querySelectorAll<HTMLElement>('.char'))
      const amp = this.amplitude

      if (this.loop) {
        const hostLeft = this.getBoundingClientRect().left
        const xs = spans.map((s) => {
          const r = s.getBoundingClientRect()
          return r.left + r.width / 2 - hostLeft
        })
        spans.forEach((span, i) => {
          const t = k * xs[i] - this.phase
          span.style.transform = `translateY(${amp * Math.sin(t)}px) rotate(${Math.atan(amp * k * Math.cos(t)) * (180 / Math.PI)}deg)`
        })
      } else {
        spans.forEach((span, i) => {
          const t = k * (this.xPositions[i] ?? 0) - this.phase
          span.style.transform = `translateY(${amp * Math.sin(t)}px) rotate(${Math.atan(amp * k * Math.cos(t)) * (180 / Math.PI)}deg)`
        })
      }

      this.raf = requestAnimationFrame(step)
    }

    this.raf = requestAnimationFrame(step)
  }

  render() {
    const chars = () =>
      [...this.text].map(
        (char) => html`<span class="char">${char === ' ' ? '\u00A0' : char}</span>`,
      )

    if (this.loop) {
      return html`
        <span class="track">
          ${Array.from(
            { length: this.numSets },
            (_, i) =>
              html`<span
                class="set"
                style="margin-right:${this.loopGap}px"
                aria-hidden=${i > 0 ? 'true' : undefined}
                >${chars()}</span
              >`,
          )}
        </span>
      `
    }

    return html`${chars()}`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-curve': MotionCurve
  }
}
