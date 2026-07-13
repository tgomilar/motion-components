import { LitElement, html, css, type PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { ref } from 'lit/directives/ref.js'
import { animate } from 'motion'
import type { AnimationPlaybackControls } from 'motion'
import { Controllable, PlaybackController } from '../../utils/playback.js'

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
export class MotionCountdown extends Controllable(LitElement) implements MotionCountdownProps {
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
  private flips = new Set<AnimationPlaybackControls>()
  private flipEpoch = 0

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

  playback: PlaybackController = new PlaybackController(this, {
    start: () => {
      this.startTicking()
      return {
        handle: {
          pause: () => this.stopTicking(),
          resume: () => this.startTicking(),
          finish: () => {
            this.stopTicking()
            this.applyTime({ days: 0, hours: 0, minutes: 0, seconds: 0 })
          },
          cancel: () => this.stopTicking(),
        },
      }
    },
    applyFinalState: () => this.applyTime({ days: 0, hours: 0, minutes: 0, seconds: 0 }),
    applyInitialState: () => this.applyTime(this.timeLeft()),
  })

  connectedCallback() {
    super.connectedCallback()
    if (this.reduced) this.startTicking()
    else void this.play()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.stopTicking()
  }

  async firstUpdated() {
    await this.updateComplete
    requestAnimationFrame(() => {
      this.ready = true
    })
  }

  protected updated(changed: PropertyValues) {
    if (changed.has('to') && this.interval !== null) this.tick()
  }

  private startTicking() {
    this.tick()
    this.interval = setInterval(() => this.tick(), 1000)
  }

  private stopTicking() {
    if (this.interval !== null) clearInterval(this.interval)
    this.interval = null
  }

  private timeLeft(): TimeLeft {
    const target = new Date(this.to).getTime()
    const diff = isNaN(target) ? 0 : Math.max(0, target - Date.now())
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    }
  }

  private setDigit(el: HTMLElement, digit: number) {
    if (this.roll) {
      const h = this.digitH(el)
      if (h) animate(el, { y: -digit * h }, { duration: 0 })
    } else {
      el.textContent = String(digit)
    }
  }

  private applyTime(next: TimeLeft) {
    this.stopFlips()
    this.time = next
    for (const unit of this.activeUnits()) {
      const padded = this.pad(next[unit])
      for (let pos = 0; pos < padded.length; pos++) {
        const key = `${unit}-${pos}`
        const digit = parseInt(padded[pos])
        this.prevDigits.set(key, digit)
        const el = this.els.get(key)
        if (!el) continue
        this.setDigit(el, digit)
        if (!this.roll) {
          el.style.transform = ''
          el.style.opacity = ''
        }
      }
    }
  }

  private tick() {
    if (isNaN(new Date(this.to).getTime())) return
    const next = this.timeLeft()

    for (const unit of this.activeUnits()) {
      const padded = this.pad(next[unit])
      for (let pos = 0; pos < padded.length; pos++) {
        const key = `${unit}-${pos}`
        const newDigit = parseInt(padded[pos])
        const oldDigit = this.prevDigits.get(key)

        if (oldDigit === undefined) {
          this.prevDigits.set(key, newDigit)
          const el = this.els.get(key)
          if (el) this.setDigit(el, newDigit)
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
      const epoch = this.flipEpoch
      animate(strip, { y: -10 * h }, { duration: 0 })
      requestAnimationFrame(() => {
        if (epoch !== this.flipEpoch) return
        this.retain(animate(strip, { y: -9 * h }, spring))
      })
    } else {
      this.retain(animate(strip, { y: -newDigit * h }, spring))
    }
  }

  private retain(controls: AnimationPlaybackControls) {
    this.flips.add(controls)
    void controls.then(() => this.flips.delete(controls))
  }

  private stopFlips() {
    this.flipEpoch++
    for (const controls of this.flips) controls.stop()
    this.flips.clear()
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
    const epoch = this.flipEpoch
    const out = animate(el, { y: '-40%', opacity: 0 }, FLIP_SPRING)
    this.retain(out)
    await out
    if (epoch !== this.flipEpoch) return
    el.textContent = newVal
    this.retain(animate(el, { y: ['30%', '0%'], opacity: [0, 1] }, FLIP_SPRING))
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
          const digit = this.prevDigits.get(key) ?? 0
          if (this.roll) {
            requestAnimationFrame(() => {
              const strip = this.els.get(key)
              if (strip) this.setDigit(strip, digit)
            })
          } else {
            ;(el as HTMLElement).textContent = String(digit)
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
                      <span class="digit flip-digit" ${ref(this.ref(key))}></span>
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
