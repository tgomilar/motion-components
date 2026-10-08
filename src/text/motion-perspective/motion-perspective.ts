import { LitElement, html, css } from 'lit'
import { property } from 'lit/decorators.js'
import { Controllable, PlaybackController, frameLoop } from '../../utils/playback.js'
import type { FrameLoop } from '../../utils/playback.js'
import type { MotionPerspectiveProps, VanishDirection } from './motion-perspective.types.js'
import { customElement } from '../../utils/define.js'
import { flag, parseFlag } from '../../utils/attributes.js'

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
 * **Use it for:** a short word or title that should look as if it goes back
 * into the distance, either still or with a slow back-and-forth depth motion
 * (`loop`, previously `oscillate`).
 *
 * **Avoid it for:** long text or sentences, because the characters sit on
 * one line and never wrap. For content that should tilt in 3D toward the
 * pointer, use `motion-tilt`.
 *
 * **Accessibility:** the full text is in a visually hidden span and the
 * character spans have `aria-hidden`, so screen readers read the text once,
 * as normal words. The far characters are smaller and fainter, so check that
 * they are still readable, or lower `depth`. With `loop`, the motion
 * starts at once and does not end on its own. `pause-on-hover` reacts to the
 * mouse only, so give other users a way to stop it, for example a button
 * that calls `pause()`.
 *
 * **Reduced motion:** with `loop`, the oscillation does not start and
 * the text keeps the still perspective layout. Without `loop` nothing
 * changes, because that layout does not move.
 *
 * **Common mistakes:** placing an oscillating `motion-perspective` inside
 * running text: the characters change `font-size` on every frame, so the
 * element changes size and the text around it moves. Changing the child text
 * after the element connects has no effect; set `text` instead.
 *
 * @element motion-perspective
 *
 * @fires motion-start - When a run starts.
 * @fires motion-finish - When a run finishes, or `finish()` jumps to the end.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
 *
 * @example
 * ```html
 * <motion-perspective depth="0.7" vanish="right" loop>HORIZON</motion-perspective>
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
  /** When `true`, animate a back-and-forth depth oscillation on repeat. `oscillate` is kept as an alias for `loop`. */
  @property({ type: Boolean, converter: flag, attribute: 'loop' }) loop = false
  /** Seconds per oscillation cycle when `loop` is set. Lower is faster. */
  @property({ type: Number }) duration = 3
  /** When `true`, pause the oscillation while the cursor is over the element. */
  @property({ type: Boolean, converter: flag, attribute: 'pause-on-hover' }) pauseOnHover = false

  /** @internal Deprecated alias for `loop`, kept so existing markup keeps working. */
  static get observedAttributes() {
    return [...super.observedAttributes, 'oscillate']
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null) {
    super.attributeChangedCallback(name, old, value)
    if (name === 'oscillate') this.loop = parseFlag(value)
  }

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

  private ticker: FrameLoop | null = null
  private phase = 0

  playback: PlaybackController = new PlaybackController(this, {
    start: () => {
      this.ticker = frameLoop((dt) => this.tick(dt / 1000))
      this.ticker.start()
      return {
        handle: {
          pause: () => this.ticker?.stop(),
          resume: () => this.ticker?.start(),
          finish: () => {
            this.ticker?.stop()
            this.ticker = null
            this.applyNeutral()
          },
          cancel: () => {
            this.ticker?.stop()
            this.ticker = null
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
      changed.has('loop') ||
      changed.has('duration')

    if (needsRestart) this.setup()
  }

  private setup() {
    this.cancel()

    if (!this.loop) {
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
      const p = i / Math.max(n - 1, 1)
      const t = this.vanish === 'left' ? p : 1 - p
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
    if (this.duration > 0) this.phase += dt / this.duration

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
      <span class="sr-only">${this.text}</span>
      <span class="track" aria-hidden="true">
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
