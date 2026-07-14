import { LitElement, html, css, svg, nothing } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import { Controllable, PlaybackController } from '../../utils/playback.js'
import type { MotionLiquidProps } from './motion-liquid.types.js'

export type { MotionLiquidProps } from './motion-liquid.types.js'

/**
 * Liquid-distorted text via SVG turbulence + displacement-map. Looped
 * fractal-noise warps the text into a flowing, organic shape.
 *
 * The text is rendered as SVG `<text>` and the filter is applied to that SVG
 * content directly — not to an HTML element via CSS `filter: url(#…)`. On
 * WebKit (iOS Safari and every iOS browser) a `url()` filter applied to an
 * HTML element is cached as a composited layer that only re-rasterizes when a
 * repaint is forced (e.g. scrolling), so the distortion appears frozen except
 * while scrolling. SVG content re-renders its own filtered output on every
 * SMIL tick, which animates reliably across platforms.
 *
 * Text can be set with the `text` attribute or as child text. Child text
 * doubles as a pre-upgrade fallback: the browser shows it before the
 * element is defined, so the page never paints an empty gap.
 *
 * @element motion-liquid
 *
 * @example
 * ```html
 * <motion-liquid intensity="14" speed="2.5">LIQUID</motion-liquid>
 * ```
 */
@customElement('motion-liquid')
export class MotionLiquid extends Controllable(LitElement) implements MotionLiquidProps {
  /** Text to distort. Falls back to the element's child text when unset. */
  @property({ type: String }) text?: string
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
      display: inline-block;
      overflow: visible;
      vertical-align: baseline;
    }

    text {
      fill: currentColor;
    }
  `

  @query('svg') private svgEl!: SVGSVGElement | null
  @query('text') private textEl!: SVGTextElement | null

  private resizeObserver: ResizeObserver | null = null

  playback: PlaybackController = new PlaybackController(this, {
    start: () => ({
      handle: {
        pause: () => this.svgEl?.pauseAnimations(),
        resume: () => this.svgEl?.unpauseAnimations(),
        finish: () => this.svgEl?.unpauseAnimations(),
        cancel: () => this.svgEl?.unpauseAnimations(),
      },
    }),
    applyFinalState: () => {},
    applyInitialState: () => {},
  })

  connectedCallback() {
    // eslint-disable-next-line wc/no-child-traversal-in-connectedcallback
    if (!this.text) this.text = this.textContent?.trim() ?? ''
    this.textContent = ''
    super.connectedCallback()
    this.addEventListener('mouseenter', this.onEnter)
    this.addEventListener('mouseleave', this.onLeave)
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.fit())
      this.resizeObserver.observe(this)
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener('mouseenter', this.onEnter)
    this.removeEventListener('mouseleave', this.onLeave)
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
  }

  firstUpdated() {
    if ('fonts' in document) document.fonts.ready.then(() => this.fit())
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('text')) this.fit()
  }

  private fit() {
    const svgEl = this.svgEl
    const textEl = this.textEl
    if (!svgEl || !textEl) return
    if (!this.text) return this.resetFit(svgEl)

    let box: DOMRect
    try {
      box = textEl.getBBox()
    } catch {
      return
    }
    if (!box.width || !box.height) return this.resetFit(svgEl)

    svgEl.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`)
    svgEl.setAttribute('width', String(box.width))
    svgEl.setAttribute('height', String(box.height))
    svgEl.style.verticalAlign = `${-(box.y + box.height)}px`
  }

  private resetFit(svgEl: SVGSVGElement) {
    svgEl.removeAttribute('viewBox')
    svgEl.setAttribute('width', '0')
    svgEl.setAttribute('height', '0')
    svgEl.style.verticalAlign = ''
  }

  private onEnter = () => {
    if (this.pauseOnHover) this.pause()
  }

  private onLeave = () => {
    if (this.pauseOnHover && this.playState === 'paused') void this.play()
  }

  private get shouldAnimate() {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    return !reduce && this.speed > 0
  }

  render() {
    const animate = this.shouldAnimate

    const freqDur = `${(9 / this.speed).toFixed(3)}s`
    const scaleDur = `${(5.24 / this.speed).toFixed(3)}s`
    const min = (this.intensity * 0.3).toFixed(3)
    const max = this.intensity.toFixed(3)

    return html`
      <svg role="img" aria-label=${this.text} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="liquid-filter" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.018 0.018"
              numOctaves="3"
              seed="2"
              result="noise"
            >
              ${animate
                ? svg`<animate
                    attributeName="baseFrequency"
                    dur=${freqDur}
                    values="0.018 0.018; 0.027 0.012; 0.012 0.027; 0.018 0.018"
                    repeatCount="indefinite"
                    calcMode="spline"
                    keyTimes="0; 0.33; 0.66; 1"
                    keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
                  />`
                : nothing}
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale=${this.intensity}
              xChannelSelector="R"
              yChannelSelector="G"
            >
              ${animate
                ? svg`<animate
                    attributeName="scale"
                    dur=${scaleDur}
                    values="${min}; ${max}; ${min}"
                    repeatCount="indefinite"
                    calcMode="spline"
                    keyTimes="0; 0.5; 1"
                    keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
                  />`
                : nothing}
            </feDisplacementMap>
          </filter>
        </defs>
        <text x="0" y="0" filter=${animate ? 'url(#liquid-filter)' : nothing}>${this.text}</text>
      </svg>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-liquid': MotionLiquid
  }
}
