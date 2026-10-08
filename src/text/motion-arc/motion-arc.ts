import { LitElement, html, css } from 'lit'
import { property } from 'lit/decorators.js'
import { animate } from 'motion'
import { Controllable, PlaybackController, controlsRun } from '../../utils/playback.js'
import type { PlaybackHandle } from '../../utils/playback.types.js'
import type { MotionArcProps, ArcAlign, ArcDirection } from './motion-arc.types.js'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'

const noopHandle: PlaybackHandle = { pause() {}, resume() {}, finish() {}, cancel() {} }

export type { MotionArcProps, ArcAlign, ArcDirection } from './motion-arc.types.js'

/**
 * Text laid out along a partial arc. Like `motion-circle` but only fills a
 * configurable slice. Optional rotation; supports an inner slot for content.
 *
 * **Use it for:** short labels, badges and headline accents that curve along
 * part of a circle, with an optional slow rotation set by `duration`.
 *
 * **Avoid it for:** long text or body copy. For text around a full circle,
 * use `motion-circle`. For a line of text that moves in a wave, use
 * `motion-curve`.
 *
 * **Accessibility:** screen readers read the whole text once from a visually
 * hidden copy. The positioned letters are `aria-hidden`. Content in the
 * centre slot is read as normal, so give images an `alt` text (empty if they
 * are decorative). A rotation never stops on its own, and `pause-on-hover`
 * works with a mouse only. If people must be able to stop it, add a button
 * that calls `pause()`.
 *
 * **Reduced motion:** the arc does not rotate, even when `duration` is set.
 * The text stays still in its arc shape.
 *
 * **Common mistakes:** too much text for the `radius` and `arc`. The letters
 * are spread evenly over `arc` degrees, so long text crowds together; raise
 * `radius` or `arc`. The element is always a square of twice the `radius`,
 * even for a small `arc`, so plan for the empty space it leaves.
 *
 * @element motion-arc
 *
 * @fires motion-start - When a run starts.
 * @fires motion-finish - When a run finishes, or `finish()` jumps to the end.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
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
export class MotionArc extends Controllable(LitElement) implements MotionArcProps {
  /** Text to lay out along the arc. */
  @property({ type: String }) text?: string
  /** Arc radius in pixels. */
  @property({ type: Number }) radius = 100
  /** Total angular span of the arc, in degrees. */
  @property({ type: Number }) arc = 180
  /** Where the arc opens: `'top'` (apex up) or `'bottom'` (apex down). */
  @property({ type: String }) align: ArcAlign = 'top'
  /** Seconds per full rotation. `0` disables rotation. */
  @property({ type: Number }) duration = 0
  /** Rotation direction: `'cw'` or `'ccw'`. */
  @property({ type: String }) direction: ArcDirection = 'cw'
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
    start: () => {
      if (this.duration <= 0) return { handle: noopHandle, done: Promise.resolve() }
      const ring = this.shadowRoot?.querySelector<HTMLElement>('.ring')
      if (!ring) return { handle: noopHandle }
      const to = this.direction === 'ccw' ? -360 : 360
      return controlsRun(
        animate(
          ring,
          { rotate: [0, to] },
          { duration: this.duration, repeat: Infinity, ease: 'linear' },
        ),
      )
    },
    applyFinalState: () => {
      const ring = this.shadowRoot?.querySelector<HTMLElement>('.ring')
      if (ring) ring.style.rotate = this.direction === 'ccw' ? '-360deg' : '360deg'
    },
    applyInitialState: () => {
      const ring = this.shadowRoot?.querySelector<HTMLElement>('.ring')
      if (ring) ring.style.rotate = ''
    },
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
      changed.has('arc') ||
      changed.has('align') ||
      changed.has('duration') ||
      changed.has('direction') ||
      changed.has('upright')

    if (needsRestart) {
      this.cancel()
      void this.play()
    }
  }

  private onEnter = () => {
    if (this.pauseOnHover && this.playState === 'running') this.pause()
  }
  private onLeave = () => {
    if (this.pauseOnHover && this.playState === 'paused') void this.play()
  }

  render() {
    const chars = [...(this.text ?? '')]
    const n = chars.length
    const size = this.radius * 2

    const bottom = this.align === 'bottom'
    const step = n > 1 ? this.arc / (n - 1) : 0
    const startAngle = bottom ? this.arc / 2 : -this.arc / 2
    const offset = bottom ? this.radius : -this.radius

    return html`
      <span class="sr-only">${this.text}</span>
      <div class="container" style="width:${size}px;height:${size}px">
        <div class="ring" aria-hidden="true">
          ${chars.map((char, i) => {
            const angle = n > 1 ? startAngle + (bottom ? -i : i) * step : 0
            const counterRotate = this.upright ? ` rotate(${-angle}deg)` : ''
            const transform = `translate(-50%,-50%) rotate(${angle}deg) translateY(${offset}px)${counterRotate}`
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
