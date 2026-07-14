import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { animate } from 'motion'
import { Controllable, PlaybackController } from '../../utils/playback.js'
import type { PlaybackRun } from '../../utils/playback.js'
import type { MotionCircleProps, CircleDirection } from './motion-circle.types.js'

export type { MotionCircleProps, CircleDirection } from './motion-circle.types.js'

/**
 * Text wrapped around a full circle, optionally rotating. Place a logo or
 * icon inside the default slot to render in the centre.
 *
 * @element motion-circle
 *
 * @slot - Optional content rendered at the centre of the circle.
 *
 * @example
 * ```html
 * <motion-circle text="ROTATING • TEXT • " radius="100" speed="12">
 *   <img src="logo.svg" alt="" width="40" />
 * </motion-circle>
 * ```
 */
@customElement('motion-circle')
export class MotionCircle extends Controllable(LitElement) implements MotionCircleProps {
  /** Text to lay out around the circle. */
  @property({ type: String }) text?: string
  /** Circle radius in pixels. */
  @property({ type: Number }) radius = 80
  /** Seconds per full rotation. Set to a small number for fast spin. */
  @property({ type: Number }) speed = 8
  /** Rotation direction: `'cw'` (clockwise) or `'ccw'` (counter-clockwise). */
  @property({ type: String }) direction: CircleDirection = 'cw'
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

  playback: PlaybackController = new PlaybackController(this, {
    start: () => this.startRun(),
    applyFinalState: () => this.resetRing(),
    applyInitialState: () => this.resetRing(),
  })

  connectedCallback() {
    super.connectedCallback()
    this.addEventListener('mouseenter', this.onEnter)
    this.addEventListener('mouseleave', this.onLeave)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener('mouseenter', this.onEnter)
    this.removeEventListener('mouseleave', this.onLeave)
  }

  updated(changed: Map<string, unknown>) {
    const needsRestart =
      changed.has('text') ||
      changed.has('radius') ||
      changed.has('speed') ||
      changed.has('direction') ||
      changed.has('upright')

    if (needsRestart) this.restart()
  }

  private onEnter = () => {
    if (this.pauseOnHover) this.pause()
  }
  private onLeave = () => {
    if (this.pauseOnHover && this.playState === 'paused') void this.play()
  }

  private restart() {
    this.playback.teardown()
    void this.play()
  }

  private startRun(): PlaybackRun {
    const ring = this.shadowRoot?.querySelector<HTMLElement>('.ring')
    if (!ring) {
      return {
        handle: { pause: () => {}, resume: () => {}, finish: () => {}, cancel: () => {} },
        done: Promise.resolve(),
      }
    }

    const to = this.direction === 'ccw' ? -360 : 360
    const controls = animate(
      ring,
      { rotate: [0, to] },
      { duration: this.speed, repeat: Infinity, ease: 'linear' },
    )
    return {
      handle: {
        pause: () => controls.pause(),
        resume: () => controls.play(),
        finish: () => controls.cancel(),
        cancel: () => controls.cancel(),
      },
    }
  }

  private resetRing() {
    const ring = this.shadowRoot?.querySelector<HTMLElement>('.ring')
    if (ring) ring.style.transform = ''
  }

  render() {
    const chars = [...(this.text ?? '')]
    const n = chars.length
    const size = this.radius * 2

    return html`
      <div class="container" style="width:${size}px;height:${size}px">
        <div class="ring">
          ${chars.map((char, i) => {
            const angle = (360 / n) * i - 90
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
    'motion-circle': MotionCircle
  }
}
