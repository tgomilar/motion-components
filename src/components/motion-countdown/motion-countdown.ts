import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { ref } from 'lit/directives/ref.js'
import { animate } from 'motion'

const FLIP_SPRING = { type: 'spring', stiffness: 160, damping: 22 } as const
import type { MotionCountdownProps } from './motion-countdown.types.js'

export type { MotionCountdownProps } from './motion-countdown.types.js'

type Unit = 'days' | 'hours' | 'minutes' | 'seconds'

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

const LABELS: Record<Unit, string> = {
  days: 'Days',
  hours: 'Hours',
  minutes: 'Minutes',
  seconds: 'Seconds',
}

const ALL_UNITS: Unit[] = ['days', 'hours', 'minutes', 'seconds']
const STRIP = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0]

/**
 * Countdown timer with animated digit transitions. Supports flip (default) and
 * roll (slot-machine) modes. Customisable format, labels, and target date.
 *
 * @element motion-countdown
 *
 * @example
 * ```html
 * <motion-countdown to="2026-12-31T23:59:59" format="days hours minutes seconds" labels roll></motion-countdown>
 * ```
 */
@customElement('motion-countdown')
export class MotionCountdown extends LitElement implements MotionCountdownProps {
  /** ISO date string the countdown counts down to. */
  @property({ type: String, reflect: true }) to = ''
  /** Space-separated list of units to display: `days`, `hours`, `minutes`, `seconds`. */
  @property({ type: String, reflect: true }) format = 'days hours minutes seconds'
  /** Whether to show unit labels (Days, Hours, etc.) beneath each value. */
  @property({ type: Boolean, reflect: true }) labels = true
  /** Enable slot-machine roll animation instead of the default flip. */
  @property({ type: Boolean, reflect: true }) roll = false

  @state() private time: TimeLeft = { days: 0, hours: 0, minutes: 0, seconds: 0 }

  private prevDigits = new Map<string, number>()
  private els = new Map<string, HTMLElement>()
  private refCache = new Map<string, (el: Element | undefined) => void>()
  private interval: ReturnType<typeof setInterval> | null = null
  private ready = false

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  static styles = css`
    :host {
      display: inline-flex;
      align-items: flex-start;
      gap: var(--countdown-gap, 0.75rem);
      font-variant-numeric: tabular-nums;
    }

    .unit {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      font-size: var(--countdown-size, 3.5rem);
    }

    .digits {
      display: flex;
      gap: 0.02em;
    }

    .reel {
      height: 1em;
      overflow: hidden;
    }

    .strip {
      display: flex;
      flex-direction: column;
      will-change: transform;
    }

    .flip-wrap {
      overflow: hidden;
      line-height: 1;
    }

    .flip-digit {
      display: block;
      line-height: 1;
    }

    .digit {
      display: block;
      font-size: 1em;
      font-weight: 800;
      color: var(--countdown-color, currentColor);
      letter-spacing: -0.04em;
      line-height: 1;
      user-select: none;
    }

    .label {
      font-size: var(--countdown-label-size, 0.65rem);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--countdown-label-color, currentColor);
      opacity: 0.4;
    }

    .sep {
      font-size: var(--countdown-size, 3.5rem);
      font-weight: 800;
      color: var(--countdown-color, currentColor);
      opacity: 0.2;
      line-height: 1;
      align-self: flex-start;
      user-select: none;
    }
  `

  connectedCallback() {
    super.connectedCallback()
    this.tick()
    this.interval = setInterval(() => this.tick(), 1000)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    if (this.interval !== null) clearInterval(this.interval)
  }

  async firstUpdated() {
    await this.updateComplete
    requestAnimationFrame(() => {
      this.ready = true
    })
  }

  private tick() {
    const target = new Date(this.to).getTime()
    if (isNaN(target)) return

    const diff = Math.max(0, target - Date.now())
    const next: TimeLeft = {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    }

    for (const unit of this.activeUnits()) {
      const padded = this.pad(next[unit])
      for (let pos = 0; pos < padded.length; pos++) {
        const key = `${unit}-${pos}`
        const newDigit = parseInt(padded[pos])
        const oldDigit = this.prevDigits.get(key)

        if (oldDigit === undefined) {
          this.prevDigits.set(key, newDigit)
        } else if (this.ready && newDigit !== oldDigit) {
          this.prevDigits.set(key, newDigit)
          const el = this.els.get(key)
          if (el) {
            if (this.roll) {
              this.rollDigit(el, oldDigit, newDigit)
            } else {
              this.flipDigit(el, String(newDigit))
            }
          }
        }
      }
    }

    this.time = next
  }

  private rollDigit(strip: HTMLElement, oldDigit: number, newDigit: number) {
    const h = this.digitH(strip)
    if (!h) return

    if (this.reduced) {
      animate(strip, { y: -newDigit * h }, { duration: 0 })
      return
    }

    const spring = { type: 'spring', stiffness: 220, damping: 28 } as const
    if (newDigit > oldDigit) {
      animate(strip, { y: -10 * h }, { duration: 0 })
      requestAnimationFrame(() => {
        animate(strip, { y: -9 * h }, spring)
      })
    } else {
      animate(strip, { y: -newDigit * h }, spring)
    }
  }

  private digitH(strip: HTMLElement): number {
    const fromChild = (strip.firstElementChild as HTMLElement)?.offsetHeight
    if (fromChild > 0) return fromChild
    const fromFont = parseFloat(getComputedStyle(strip).fontSize)
    if (fromFont > 0) return fromFont
    return 56
  }

  private async flipDigit(el: HTMLElement, newVal: string) {
    if (this.reduced) {
      el.textContent = newVal
      return
    }
    await animate(el, { y: '-40%', opacity: 0 }, FLIP_SPRING)
    el.textContent = newVal
    animate(el, { y: ['30%', '0%'], opacity: [0, 1] }, FLIP_SPRING)
  }

  private pad(n: number): string {
    return String(n).padStart(2, '0')
  }

  private activeUnits(): Unit[] {
    const wanted = new Set(this.format.split(/\s+/))
    return ALL_UNITS.filter((u) => wanted.has(u))
  }

  private ref(key: string) {
    if (!this.refCache.has(key)) {
      this.refCache.set(key, (el: Element | undefined) => {
        if (el) {
          this.els.set(key, el as HTMLElement)
          if (this.roll) {
            const digit = this.prevDigits.get(key) ?? 0
            requestAnimationFrame(() => {
              const strip = this.els.get(key)
              if (!strip) return
              const h = this.digitH(strip)
              animate(strip, { y: -digit * h }, { duration: 0 })
            })
          }
        } else {
          this.els.delete(key)
        }
      })
    }
    return this.refCache.get(key)!
  }

  render() {
    const units = this.activeUnits()
    return html`
      ${units.map((unit, i) => {
        const padded = this.pad(this.time[unit])
        return html`
          ${i > 0 ? html`<span class="sep" aria-hidden="true">:</span>` : ''}
          <div class="unit">
            <div class="digits">
              ${Array.from({ length: padded.length }, (_, pos) => {
                const key = `${unit}-${pos}`
                return this.roll
                  ? html` <div class="reel">
                      <div class="strip" ${ref(this.ref(key))}>
                        ${STRIP.map((d) => html`<span class="digit">${d}</span>`)}
                      </div>
                    </div>`
                  : html` <div class="flip-wrap">
                      <span class="digit flip-digit" ${ref(this.ref(key))}>${padded[pos]}</span>
                    </div>`
              })}
            </div>
            ${this.labels ? html`<span class="label">${LABELS[unit]}</span>` : ''}
          </div>
        `
      })}
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-countdown': MotionCountdown
  }
}
