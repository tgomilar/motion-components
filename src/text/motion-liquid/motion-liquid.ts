import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { MotionLiquidProps } from './motion-liquid.types.js'

export type { MotionLiquidProps } from './motion-liquid.types.js'

/**
 * Liquid-distorted text via SVG turbulence + displacement-map. Looped
 * fractal-noise warps the text into a flowing, organic shape.
 *
 * @element motion-liquid
 *
 * @example
 * ```html
 * <motion-liquid text="LIQUID" intensity="14" speed="2.5"></motion-liquid>
 * ```
 */
@customElement('motion-liquid')
export class MotionLiquid extends LitElement implements MotionLiquidProps {
  /** Text to distort. */
  @property({ type: String }) text = ''
  /** Maximum displacement amount in pixels (peak of the noise pulse). */
  @property({ type: Number }) intensity = 10
  /** Animation speed of the noise / displacement loop. */
  @property({ type: Number }) speed = 2
  /** When `true`, pause the distortion loop while the cursor is over the element. */
  @property({ type: Boolean, attribute: 'pause-on-hover' }) pauseOnHover = false

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

    svg {
      position: absolute;
      width: 0;
      height: 0;
      pointer-events: none;
    }

    .text {
      display: inline-block;
    }
  `

  private raf: number | null = null
  private t = 0
  private paused = false

  connectedCallback() {
    super.connectedCallback()
    this.addEventListener('mouseenter', this.onEnter)
    this.addEventListener('mouseleave', this.onLeave)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    if (this.raf !== null) cancelAnimationFrame(this.raf)
    this.removeEventListener('mouseenter', this.onEnter)
    this.removeEventListener('mouseleave', this.onLeave)
  }

  private onEnter = () => {
    if (this.pauseOnHover) this.paused = true
  }
  private onLeave = () => {
    if (this.pauseOnHover) this.paused = false
  }

  updated(changed: Map<string, unknown>) {
    const needsRestart = changed.has('intensity') || changed.has('speed') || changed.has('text')
    if (needsRestart) this.startLoop()
  }

  private startLoop() {
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf)
      this.raf = null
    }
    this.t = 0

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const turbulence = this.shadowRoot!.querySelector<SVGFETurbulenceElement>('feTurbulence')
    const displacement =
      this.shadowRoot!.querySelector<SVGFEDisplacementMapElement>('feDisplacementMap')
    if (!turbulence || !displacement) return

    let last = performance.now()

    const step = (now: number) => {
      const dt = (now - last) / 1000
      last = now

      if (!this.paused) {
        this.t += dt * this.speed
      }

      const t = this.t
      const bfx = 0.018 + Math.sin(t * 0.7) * 0.009
      const bfy = 0.018 + Math.cos(t * 0.5) * 0.009
      turbulence.setAttribute('baseFrequency', `${bfx} ${bfy}`)

      const scale = this.intensity * (0.3 + 0.7 * ((Math.sin(t * 1.2) + 1) / 2))
      displacement.setAttribute('scale', String(scale))

      this.raf = requestAnimationFrame(step)
    }

    this.raf = requestAnimationFrame(step)
  }

  render() {
    return html`
      <svg aria-hidden="true">
        <defs>
          <filter id="liquid-filter" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.018 0.018"
              numOctaves="3"
              seed="2"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale=${this.intensity}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>
      <span class="text" style="filter: url(#liquid-filter)">${this.text}</span>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-liquid': MotionLiquid
  }
}
