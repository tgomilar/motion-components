import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { animate, stagger } from 'motion'
import { Controllable, PlaybackController, controlsRun } from '../../utils/playback.js'
import type { MotionGravityProps } from './motion-gravity.types.js'

export type { MotionGravityProps } from './motion-gravity.types.js'

/**
 * Gravity-drop text. Each character falls in from above and bounces to rest
 * with a stagger across the line.
 *
 * @element motion-gravity
 *
 * @example
 * ```html
 * <motion-gravity text="GRAVITY" height="80" stagger="0.06"></motion-gravity>
 * ```
 */
@customElement('motion-gravity')
export class MotionGravity extends Controllable(LitElement) implements MotionGravityProps {
  /** Text to drop in. */
  @property({ type: String }) text = ''
  /** Drop distance in pixels (each char starts this far above its rest). */
  @property({ type: Number }) height = 60
  /** Delay between successive character drops, in seconds. */
  @property({ type: Number }) stagger = 0.05
  /** Spring duration of each character's fall, in seconds. */
  @property({ type: Number }) duration = 0.6
  /** Delay before the first character starts falling, in seconds. */
  @property({ type: Number }) delay = 0

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

    .char {
      display: inline-block;
      white-space: pre;
      will-change: transform, opacity;
    }
  `

  playback: PlaybackController = new PlaybackController(this, {
    start: () => {
      const chars = Array.from(this.shadowRoot!.querySelectorAll<HTMLElement>('.char'))
      if (!chars.length) return { handle: { pause() {}, resume() {}, finish() {}, cancel() {} } }
      return controlsRun(
        animate(
          chars,
          { y: [-this.height, 0], opacity: [0, 1] },
          {
            delay: stagger(this.stagger, { startDelay: this.delay }),
            duration: this.duration,
            type: 'spring',
            stiffness: 380,
            damping: 22,
          },
        ),
      )
    },
    applyFinalState: () => {
      const chars = this.shadowRoot?.querySelectorAll<HTMLElement>('.char')
      if (chars) {
        for (const char of chars) {
          char.style.opacity = '1'
          char.style.transform = ''
        }
      }
    },
    applyInitialState: () => {
      const chars = this.shadowRoot?.querySelectorAll<HTMLElement>('.char')
      if (chars) {
        for (const char of chars) {
          char.style.opacity = '0'
          char.style.transform = `translateY(${-this.height}px)`
        }
      }
    },
  })

  updated(changed: Map<string, unknown>) {
    const needsPlay =
      changed.has('text') ||
      changed.has('height') ||
      changed.has('stagger') ||
      changed.has('duration') ||
      changed.has('delay')

    if (needsPlay) {
      this.cancel()
      void this.play()
    }
  }

  /** Resets and re-runs the gravity drop. */
  replay() {
    this.cancel()
    void this.play()
  }

  render() {
    return html`${[...this.text].map(
      (char) => html`<span class="char">${char === ' ' ? '\u00A0' : char}</span>`,
    )}`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-gravity': MotionGravity
  }
}
