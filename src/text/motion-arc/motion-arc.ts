import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { animate } from 'motion'
import type { AnimationPlaybackControls } from 'motion'
import type { MotionArcProps, ArcAlign, ArcDirection } from './motion-arc.types.js'

export type { MotionArcProps, ArcAlign, ArcDirection } from './motion-arc.types.js'

/**
 * Text laid out along a partial arc. Like `motion-circle` but only fills a
 * configurable slice. Optional rotation; supports an inner slot for content.
 *
 * @element motion-arc
 *
 * @slot - Optional content rendered at the centre of the arc.
 *
 * @example
 * ```html
 * <motion-arc text="CURVED HEADLINE" radius="180" arc="160" align="top">
 * </motion-arc>
 * ```
 */
@customElement('motion-arc')
export class MotionArc extends LitElement implements MotionArcProps {
  /** Text to lay out along the arc. */
  @property({ type: String }) text = ''
  /** Arc radius in pixels. */
  @property({ type: Number }) radius = 100
  /** Total angular span of the arc, in degrees. */
  @property({ type: Number }) arc = 180
  /** Where the arc opens: `'top'` (apex up) or `'bottom'` (apex down). */
  @property({ type: String }) align: ArcAlign = 'top'
  /** Seconds per full rotation. `0` disables rotation. */
  @property({ type: Number }) speed = 0
  /** Rotation direction: `'cw'` or `'ccw'`. */
  @property({ type: String }) direction: ArcDirection = 'cw'
  /** When `true`, counter-rotate each glyph so it stays visually upright. */
  @property({ type: Boolean }) upright = false
  /** When `true`, pause the rotation while the cursor is over the element. */
  @property({ type: Boolean, attribute: 'pause-on-hover' }) pauseOnHover = false

  static styles = css`
    :host {
      display: inline-block;
      font-size: inherit;
      font-weight: inherit;
      font-family: inherit;
      font-style: inherit;
      letter-spacing: inherit;
      line-height: 1;
    }

    .container {
      position: relative;
    }

    .ring {
      position: absolute;
      inset: 0;
      will-change: transform;
    }

    .center {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .char {
      position: absolute;
      top: 50%;
      left: 50%;
      display: inline-block;
      white-space: pre;
    }
  `

  private controls: AnimationPlaybackControls | null = null

  connectedCallback() {
    super.connectedCallback()
    this.addEventListener('mouseenter', this.onEnter)
    this.addEventListener('mouseleave', this.onLeave)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.controls?.stop()
    this.removeEventListener('mouseenter', this.onEnter)
    this.removeEventListener('mouseleave', this.onLeave)
  }

  updated(changed: Map<string, unknown>) {
    const needsRestart =
      changed.has('text') ||
      changed.has('radius') ||
      changed.has('arc') ||
      changed.has('align') ||
      changed.has('speed') ||
      changed.has('direction') ||
      changed.has('upright')

    if (needsRestart) this.startAnimation()
  }

  private onEnter = () => {
    if (this.pauseOnHover) this.controls?.pause()
  }
  private onLeave = () => {
    if (this.pauseOnHover) this.controls?.play()
  }

  private startAnimation() {
    this.controls?.stop()
    this.controls = null

    if (this.speed === 0) return

    const ring = this.shadowRoot?.querySelector<HTMLElement>('.ring')
    if (!ring) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const to = this.direction === 'ccw' ? -360 : 360
    this.controls = animate(
      ring,
      { rotate: [0, to] },
      { duration: this.speed, repeat: Infinity, ease: 'linear' },
    )
  }

  render() {
    const chars = [...this.text]
    const n = chars.length
    const size = this.radius * 2

    // align="top" → center of arc at 270° (top of circle)
    // align="bottom" → center of arc at 90° (bottom of circle)
    const centerAngle = this.align === 'top' ? -90 : 90
    const halfArc = this.arc / 2
    const startAngle = centerAngle - halfArc

    return html`
      <div class="container" style="width:${size}px;height:${size}px">
        <div class="ring">
          ${chars.map((char, i) => {
            const angle = n > 1 ? startAngle + (i / (n - 1)) * this.arc : centerAngle
            const counterRotate = this.upright ? ` rotate(${-angle}deg)` : ''
            const transform = `translate(-50%,-50%) rotate(${angle}deg) translateY(${-this.radius}px)${counterRotate}`
            return html`<span class="char" style="transform:${transform}"
              >${char === ' ' ? '\u00A0' : char}</span
            >`
          })}
        </div>
        <div class="center"><slot></slot></div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-arc': MotionArc
  }
}
