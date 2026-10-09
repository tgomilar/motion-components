import { LitElement, html, css } from 'lit'
import { property } from 'lit/decorators.js'
import { animate } from 'motion'
import { Controllable, PlaybackController } from '../../utils/playback.js'
import type { PlaybackRun } from '../../utils/playback.js'
import type { MotionCircleProps, CircleDirection } from './motion-circle.types.js'
import { pauseOnHover } from '../utils/loop.js'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'

export type { MotionCircleProps, CircleDirection } from './motion-circle.types.js'

/**
 * Text wrapped around a full circle, optionally rotating. Place a logo or
 * icon inside the default slot to render in the centre.
 *
 * **Use it for:** rotating badges and stamps, such as a short label that
 * circles a logo or an icon in the centre slot.
 *
 * **Avoid it for:** text that people must read quickly, because rotating text
 * is hard to read. For text along part of a circle, use `motion-arc`.
 *
 * **Accessibility:** screen readers read the whole text once from a visually
 * hidden copy. The rotating letters are `aria-hidden`. Content in the centre
 * slot is read as normal, so give images an `alt` text (empty if they are
 * decorative). The rotation never stops on its own, and `pause-on-hover`
 * works with a mouse only. If people must be able to stop it, add a button
 * that calls `pause()`.
 *
 * **Reduced motion:** the ring does not rotate. The text stays still around
 * the circle.
 *
 * **Common mistakes:** text with no separator at the end. The letters are
 * spaced evenly around the full circle, so the last word runs into the first;
 * end the text with a separator such as ` • `, as in the example. Too much
 * text for the `radius` makes the letters crowd together.
 *
 * @element motion-circle
 *
 * @fires motion-start - When a run starts.
 * @fires motion-finish - When a run finishes, or `finish()` jumps to the end.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
 *
 * @slot - Optional content rendered at the centre of the circle.
 *
 * @example
 * ```html
 * <motion-circle text="ROTATING • TEXT • " radius="100" duration="12">
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
  /** Seconds per full rotation. Lower is faster. */
  @property({ type: Number }) duration = 8
  /** Rotation direction: `'cw'` (clockwise) or `'ccw'` (counter-clockwise). */
  @property({ type: String }) direction: CircleDirection = 'cw'
  /** When `true`, counter-rotate each glyph so it stays visually upright. */
  @property({ type: Boolean, converter: flag }) upright = false
  /** When `true`, pause the rotation while the cursor is over the element. */
  @property({ type: Boolean, converter: flag, attribute: 'pause-on-hover' }) pauseOnHover = false

  static styles = css`
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
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

  private detachHover: (() => void) | null = null

  connectedCallback() {
    super.connectedCallback()
    this.detachHover = pauseOnHover(
      this,
      () => this.pauseOnHover,
      () => this.pause(),
      () => void this.play(),
    )
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.detachHover?.()
    this.detachHover = null
  }

  updated(changed: Map<string, unknown>) {
    const needsRestart =
      changed.has('text') ||
      changed.has('radius') ||
      changed.has('duration') ||
      changed.has('direction') ||
      changed.has('upright')

    if (needsRestart) this.restart()
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
      { duration: this.duration, repeat: Infinity, ease: 'linear' },
    )
    return {
      handle: {
        pause: () => controls.pause(),
        resume: () => controls.play(),
        finish: () => controls.complete(),
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
      <span class="sr-only">${this.text}</span>
      <div class="container" style="width:${size}px;height:${size}px">
        <div class="ring" aria-hidden="true">
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
