import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { animate, stagger } from 'motion'
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
export class MotionGravity extends LitElement implements MotionGravityProps {
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

  updated(changed: Map<string, unknown>) {
    const needsPlay =
      changed.has('text') ||
      changed.has('height') ||
      changed.has('stagger') ||
      changed.has('duration') ||
      changed.has('delay')

    if (needsPlay) this.play()
  }

  private play() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const chars = Array.from(this.shadowRoot!.querySelectorAll<HTMLElement>('.char'))
    if (!chars.length) return

    // Set initial hidden state before animating
    chars.forEach((char) => {
      char.style.opacity = '0'
      char.style.transform = `translateY(${-this.height}px)`
    })

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
    )
  }

  replay() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const chars = Array.from(this.shadowRoot!.querySelectorAll<HTMLElement>('.char'))
    if (!chars.length) return
    animate(chars, { opacity: 0, y: -this.height }, { duration: 0 }).then(() => this.play())
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
