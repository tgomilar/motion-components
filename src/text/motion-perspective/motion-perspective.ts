import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { MotionPerspectiveProps, VanishDirection } from './motion-perspective.types.js'

export type { MotionPerspectiveProps, VanishDirection } from './motion-perspective.types.js'

/**
 * Vanishing-point text. Each character shrinks and fades along the
 * vanish direction, simulating a 3D recession. Optionally animates the
 * recession back and forth like a depth oscillation.
 *
 * @element motion-perspective
 *
 * @example
 * ```html
 * <motion-perspective text="HORIZON" depth="0.7" vanish="right" animate>
 * </motion-perspective>
 * ```
 */
@customElement('motion-perspective')
export class MotionPerspective extends LitElement implements MotionPerspectiveProps {
  /** Text to render with depth. */
  @property({ type: String }) text = ''
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

  private raf: number | null = null
  private phase = 0
  private paused = false

  connectedCallback() {
    super.connectedCallback()
    this.addEventListener('mouseenter', this.onEnter)
    this.addEventListener('mouseleave', this.onLeave)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    if (this.raf !== null) cancelAnimationFrame(this.raf)
    this.removeEventListener('mouseenter', this.onEnter)
    this.removeEventListener('mouseleave', this.onLeave)
  }

  private onEnter = () => {
    if (this.pauseOnHover) this.paused = true
  }
  private onLeave = () => {
    if (this.pauseOnHover) this.paused = false
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
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf)
      this.raf = null
    }
    this.phase = 0

    if (!this.oscillate) {
      this.applyStatic()
      return
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.applyStatic()
      return
    }

    this.startLoop()
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

  private startLoop() {
    let last = performance.now()

    const step = (now: number) => {
      const dt = (now - last) / 1000
      last = now

      if (!this.paused) {
        this.phase += this.speed * dt
      }

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

      this.raf = requestAnimationFrame(step)
    }

    this.raf = requestAnimationFrame(step)
  }

  render() {
    return html`
      <span class="track">
        ${[...this.text].map(
          (char) => html`<span class="char">${char === ' ' ? '\u00A0' : char}</span>`,
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
