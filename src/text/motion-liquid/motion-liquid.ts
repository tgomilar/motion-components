import { LitElement, html, css, svg, nothing } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
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

  private hovered = false
  private resizeObserver: ResizeObserver | null = null

  connectedCallback() {
    super.connectedCallback()
    this.addEventListener('mouseenter', this.onEnter)
    this.addEventListener('mouseleave', this.onLeave)
    // Re-fit on zoom, container resize, or CSS-driven font-size changes — none
    // of which fire a Lit update.
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
    // Re-fit once web fonts settle, since metrics change after they load.
    if ('fonts' in document) document.fonts.ready.then(() => this.fit())
  }

  updated(changed: Map<string, unknown>) {
    // Only the text (and font/size events handled elsewhere) changes geometry,
    // so avoid a forced getBBox reflow on speed/intensity/pause-only updates.
    if (changed.has('text')) this.fit()
    if (changed.has('pauseOnHover')) this.syncPause()
  }

  /** Size the SVG viewport to the text's bounding box so layout reserves the
   * right space; `overflow: visible` lets the displaced pixels draw outside. */
  private fit() {
    const svgEl = this.svgEl
    const textEl = this.textEl
    if (!svgEl || !textEl) return
    if (!this.text) return this.resetFit(svgEl)

    let box: DOMRect
    try {
      box = textEl.getBBox()
    } catch {
      // getBBox throws when an ancestor is display:none; keep the last good
      // size rather than collapsing a temporarily-hidden element.
      return
    }
    if (!box.width || !box.height) return this.resetFit(svgEl)

    svgEl.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`)
    svgEl.setAttribute('width', String(box.width))
    svgEl.setAttribute('height', String(box.height))

    // Text is drawn on its alphabetic baseline at y=0, so the box bottom sits
    // `box.y + box.height` px below the baseline (the descender depth). The
    // inline SVG aligns its bottom edge to the parent baseline, so shift it
    // down by that amount to land the text baseline on the parent baseline.
    svgEl.style.verticalAlign = `${-(box.y + box.height)}px`
  }

  /** Collapse the SVG to nothing so empty text reserves no space. */
  private resetFit(svgEl: SVGSVGElement) {
    svgEl.removeAttribute('viewBox')
    svgEl.setAttribute('width', '0')
    svgEl.setAttribute('height', '0')
    svgEl.style.verticalAlign = ''
  }

  private onEnter = () => {
    this.hovered = true
    this.syncPause()
  }
  private onLeave = () => {
    this.hovered = false
    this.syncPause()
  }

  /** Pause the SMIL timeline only while hovered AND pause-on-hover is on, and
   * resume otherwise — so toggling the prop off mid-hover doesn't strand it. */
  private syncPause() {
    const svgEl = this.svgEl
    if (!svgEl) return
    if (this.pauseOnHover && this.hovered) svgEl.pauseAnimations()
    else svgEl.unpauseAnimations()
  }

  private get shouldAnimate() {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    return !reduce && this.speed > 0
  }

  render() {
    const animate = this.shouldAnimate

    // Each primitive loops on its own period (derived from `speed`) so the
    // turbulence wander and the displacement pulse stay decoupled — that
    // mismatch is what reads as organic, flowing motion.
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
