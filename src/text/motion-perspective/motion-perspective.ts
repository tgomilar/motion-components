import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { Controllable, PlaybackController, frameLoop } from '../../utils/playback.js'
import type { FrameLoop } from '../../utils/playback.js'
import type { MotionPerspectiveProps, VanishDirection } from './motion-perspective.types.js'

export type { MotionPerspectiveProps, VanishDirection } from './motion-perspective.types.js'

/**
 * Vanishing-point text. Each character shrinks and fades along the
 * vanish direction, simulating a 3D recession. Optionally animates the
 * recession back and forth like a depth oscillation.
 *
 * Text can be set with the `text` attribute or as child text. Child text
 * doubles as a pre-upgrade fallback: the browser shows it before the
 * element is defined, so the page never paints an empty gap.
 *
 * @element motion-perspective
 *
 * @example
 * ```html
 * <motion-perspective depth="0.7" vanish="right" animate>HORIZON</motion-perspective>
 * ```
 */
@customElement('motion-perspective')
export class MotionPerspective extends Controllable(LitElement) implements MotionPerspectiveProps {
  /** Text to render with depth. Falls back to the element's child text when unset. */
  @property({ type: String }) text?: string
  /** How far the far end recedes (0 = flat, 1 = full vanish). */
  @property({ type: Number }) depth = 0.65
  /** Direction the text recedes towards: `'left'` or `'right'`. */
  @property({ type: String }) vanish: VanishDirection = 'left'
  /** When `true`, animate a back-and-forth depth oscillation. */
  @property({ type: Boolean, attribute: 'animate' }) oscillate = false
  /** Oscillation speed in cycles per second when `animate` is true. */
  @property({ type: Number }) speed = 1.5
  /** When `true`, pause the oscillation while the cursor is over the element. */
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

    .track {
      display: inline-flex;
      align-items: flex-end;
    }

    .char {
      display: inline-block;
      white-space: pre;
      line-height: 1;
    }
  `

  private loop: FrameLoop | null = null
  private phase = 0

  playback: PlaybackController = new PlaybackController(this, {
    start: () => {
      this.loop = frameLoop((dt) => this.tick(dt / 1000))
      this.loop.start()
      return {
        handle: {
          pause: () => this.loop?.stop(),
          resume: () => this.loop?.start(),
          finish: () => {
            this.loop?.stop()
            this.loop = null
            this.applyNeutral()
          },
          cancel: () => {
            this.loop?.stop()
            this.loop = null
          },
        },
      }
    },
    applyFinalState: () => this.applyNeutral(),
    applyInitialState: () => {
      this.phase = 0
      this.applyNeutral()
    },
  })

  connectedCallback() {
    // eslint-disable-next-line wc/no-child-traversal-in-connectedcallback
    if (!this.text) this.text = this.textContent?.trim() ?? ''
    this.textContent = ''
    super.connectedCallback()
    this.addEventListener('mouseenter', this.onEnter)
    this.addEventListener('mouseleave', this.onLeave)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener('mouseenter', this.onEnter)
    this.removeEventListener('mouseleave', this.onLeave)
  }

  private onEnter = () => {
    if (this.pauseOnHover) this.pause()
  }
  private onLeave = () => {
    if (this.pauseOnHover && this.playState === 'paused') void this.play()
  }

  updated(changed: Map<string, unknown>) {
    const needsRestart =
      changed.has('text') ||
      changed.has('depth') ||
      changed.has('vanish') ||
      changed.has('oscillate') ||
      changed.has('speed')

    if (needsRestart) this.setup()
  }

  private setup() {
    this.cancel()

    if (!this.oscillate) {
      this.applyStatic()
      return
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.applyStatic()
      return
    }

    void this.play()
  }

  private applyStatic() {
    const chars = Array.from(this.shadowRoot!.querySelectorAll<HTMLElement>('.char'))
    const n = chars.length
    chars.forEach((char, i) => {
      const t = this.vanish === 'left' ? i / (n - 1) : 1 - i / (n - 1)
      char.style.fontSize = `${1 - this.depth * (1 - t)}em`
      char.style.opacity = String(1 - (1 - t) * this.depth * 0.45)
    })
  }

  private applyNeutral() {
    for (const char of this.shadowRoot?.querySelectorAll<HTMLElement>('.char') ?? []) {
      char.style.fontSize = ''
      char.style.opacity = ''
    }
  }

  private tick(dt: number) {
    this.phase += this.speed * dt

    const chars = Array.from(this.shadowRoot!.querySelectorAll<HTMLElement>('.char'))
    const n = chars.length

    chars.forEach((char, i) => {
      const t = i / Math.max(n - 1, 1)
      // cosine creates the back-and-forth 3D rotation illusion
      const sineVal = Math.cos(this.phase * Math.PI * 2 + t * Math.PI)
      const perspT = (sineVal + 1) / 2
      char.style.fontSize = `${1 - this.depth * (1 - perspT)}em`
      char.style.opacity = String(1 - (1 - perspT) * this.depth * 0.45)
    })
  }

  render() {
    return html`
      <span class="track">
        ${[...(this.text ?? '')].map(
          (char) => html`<span class="char">${char === ' ' ? ' ' : char}</span>`,
        )}
      </span>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-perspective': MotionPerspective
  }
}
