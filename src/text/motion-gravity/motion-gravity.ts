import { LitElement, html, css } from 'lit'
import { property } from 'lit/decorators.js'
import { animate, stagger } from 'motion'
import { Controllable, PlaybackController, controlsRun } from '../../utils/playback.js'
import type { MotionGravityProps } from './motion-gravity.types.js'
import { customElement } from '../../utils/define.js'

export type { MotionGravityProps } from './motion-gravity.types.js'

/**
 * Gravity-drop text. Each character falls in from above and bounces to rest
 * with a stagger across the line.
 *
 * Text can be set with the `text` attribute or as child text. Child text
 * doubles as a pre-upgrade fallback: the browser shows it before the
 * element is defined, so the page never paints an empty gap.
 *
 * @element motion-gravity
 *
 * @example
 * ```html
 * <motion-gravity height="80" stagger="0.06">GRAVITY</motion-gravity>
 * ```
 */
@customElement('motion-gravity')
export class MotionGravity extends Controllable(LitElement) implements MotionGravityProps {
  /** Text to drop in. Falls back to the element's child text when unset. */
  @property({ type: String }) text?: string
  /** Drop distance in pixels (each char starts this far above its rest). */
  @property({ type: Number }) height = 60
  /** Delay between successive character drops, in seconds. */
  @property({ type: Number }) interval = 0.05
  /** Spring duration of each character's fall, in seconds. */
  @property({ type: Number }) duration = 0.6
  /** Spring bounciness of the landing (0 = no overshoot). */
  @property({ type: Number }) bounce = 0.45
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

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
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
      if (!chars.length) {
        return {
          handle: { pause() {}, resume() {}, finish() {}, cancel() {} },
          done: Promise.resolve(),
        }
      }
      return controlsRun(
        animate(
          chars,
          { y: [-this.height, 0], opacity: [0, 1] },
          {
            delay: stagger(this.interval, { startDelay: this.delay }),
            duration: this.duration,
            type: 'spring',
            bounce: this.bounce,
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

  connectedCallback() {
    // eslint-disable-next-line wc/no-child-traversal-in-connectedcallback
    if (!this.text) this.text = this.textContent?.trim() ?? ''
    this.textContent = ''
    super.connectedCallback()
  }

  updated(changed: Map<string, unknown>) {
    const needsPlay =
      changed.has('text') ||
      changed.has('height') ||
      changed.has('interval') ||
      changed.has('duration') ||
      changed.has('bounce') ||
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
    return html`
      <span class="sr-only">${this.text}</span>
      <span aria-hidden="true">
        ${[...(this.text ?? '')].map(
          (char) => html`<span class="char">${char === ' ' ? '\u00A0' : char}</span>`,
        )}
      </span>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-gravity': MotionGravity
  }
}
