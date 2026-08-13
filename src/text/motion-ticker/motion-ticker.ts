import { animate } from 'motion'
import type { AnimationPlaybackControls } from 'motion'
import { Controllable, PlaybackController } from '../../utils/playback.js'
import type { MotionTickerProps, TickerDirection } from './motion-ticker.types.js'

export type { MotionTickerProps, TickerDirection } from './motion-ticker.types.js'

const MIN_RATE = 0.05

/**
 * Horizontal auto-scrolling ticker / marquee. Duplicates children to create a
 * seamless infinite loop. Supports pause-on-hover, keyboard pause (Space/Enter),
 * direction control, and an optional sine-wave vertical oscillation effect.
 *
 * @element motion-ticker
 *
 * @slot - Items to scroll. Each direct child is duplicated to fill the container.
 *
 * `speed`, `gap` and `direction` are live: changing them restarts the marquee.
 * The remaining attributes are read once while the marquee is built.
 *
 * @attr {number} [speed=60] - Scroll speed in pixels per second.
 * @attr {number} [gap=32] - Gap between items in pixels.
 * @attr {'left'|'right'} [direction='left'] - Scroll direction.
 * @attr {boolean} [pause-on-hover=true] - Pause on mouse enter / focus. Set `"false"` to keep scrolling. Read once on connect.
 * @attr {boolean} [wave=false] - Enable sine-wave vertical oscillation. Read once on connect.
 * @attr {number} [wave-amplitude=10] - Wave amplitude in pixels. Read once on connect.
 * @attr {number} [wave-length=300] - Wave length in pixels. Read once on connect.
 *
 * @example
 * ```html
 * <motion-ticker speed="80" gap="48" direction="right" wave wave-amplitude="12" wave-length="200">
 *   <span>Item one</span>
 *   <span>Item two</span>
 *   <span>Item three</span>
 * </motion-ticker>
 * ```
 */
export class MotionTicker extends Controllable(HTMLElement) {
  static observedAttributes = [
    'speed',
    'gap',
    'direction',
    'pause-on-hover',
    'wave',
    'wave-amplitude',
    'wave-length',
  ]

  private ctrls: AnimationPlaybackControls | null = null
  private track: HTMLElement | null = null
  private setA: HTMLElement | null = null

  private targetRate = 1
  private currentRate = 1
  private rateRaf: number | null = null
  private waveRaf: number | null = null

  private wavePhase = 0
  private itemLocalPositions: number[] = []
  private resizeObserver: ResizeObserver | null = null

  playback: PlaybackController = new PlaybackController(this, {
    start: () => {
      this.startMarquee()
      return {
        handle: {
          pause: () => {
            this.ctrls?.pause()
            this.stopWave()
            if (this.rateRaf !== null) {
              cancelAnimationFrame(this.rateRaf)
              this.rateRaf = null
            }
          },
          resume: () => {
            this.resumeCtrls()
            if (this.wave) this.startWave()
            if (this.currentRate < 1) this.lerpRate(1)
          },
          finish: () => {
            this.ctrls?.stop()
            this.ctrls = null
            this.stopWave()
            if (this.rateRaf !== null) {
              cancelAnimationFrame(this.rateRaf)
              this.rateRaf = null
            }
          },
          cancel: () => {
            this.ctrls?.stop()
            this.ctrls = null
            this.stopWave()
            if (this.rateRaf !== null) {
              cancelAnimationFrame(this.rateRaf)
              this.rateRaf = null
            }
          },
        },
      }
    },
    applyFinalState: () => {},
    applyInitialState: () => {},
  })

  private get speed(): MotionTickerProps['speed'] {
    return Number(this.getAttribute('speed') ?? 60)
  }
  private get gap(): MotionTickerProps['gap'] {
    return Number(this.getAttribute('gap') ?? 32)
  }
  private get direction(): TickerDirection {
    return (this.getAttribute('direction') ?? 'left') as TickerDirection
  }
  private get pauseOnHover(): MotionTickerProps['pauseOnHover'] {
    return this.getAttribute('pause-on-hover') !== 'false'
  }
  private get wave(): MotionTickerProps['wave'] {
    return this.hasAttribute('wave')
  }
  private get waveAmplitude(): MotionTickerProps['waveAmplitude'] {
    return Number(this.getAttribute('wave-amplitude') ?? 10)
  }
  private get waveLength(): MotionTickerProps['waveLength'] {
    return Number(this.getAttribute('wave-length') ?? 300)
  }

  connectedCallback() {
    super.connectedCallback()
    this.style.display = 'block'
    this.style.overflow = this.wave ? 'visible' : 'hidden'
    this.style.width = '100%'
    this.setAttribute('tabindex', '0')
    this.setAttribute('role', 'region')
    this.setAttribute('aria-label', 'Scrolling ticker. Press Space to pause.')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    requestAnimationFrame(() => this.build())
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.ctrls?.stop()
    if (this.rateRaf !== null) cancelAnimationFrame(this.rateRaf)
    this.stopWave()
    this.resizeObserver?.disconnect()
    this.removeEventListener('mouseenter', this.onEnter)
    this.removeEventListener('mouseleave', this.onLeave)
    this.removeEventListener('focus', this.onEnter)
    this.removeEventListener('blur', this.onLeave)
    this.removeEventListener('keydown', this.onKeyDown)
  }

  attributeChangedCallback() {
    if (!this.ctrls || !this.setA) return
    const w = this.setA.offsetWidth + this.gap
    if (!w) return
    const progress = (this.ctrls.time / (w / this.speed)) % 1
    this.ctrls.stop()
    this.ctrls = animate(
      this.track!,
      { x: this.direction === 'left' ? [0, -w] : [-w, 0] },
      { duration: w / this.speed, repeat: Infinity, ease: 'linear' },
    )
    this.ctrls.time = progress * (w / this.speed)
  }

  private build() {
    const items = Array.from(this.children) as HTMLElement[]
    if (!items.length) return

    const gap = `${this.gap}px`
    const track = node('div', {
      display: 'flex',
      alignItems: 'center',
      width: 'max-content',
      willChange: 'transform',
    })
    const setA = node('div', {
      display: 'flex',
      alignItems: 'center',
      flexShrink: '0',
      columnGap: gap,
      marginRight: gap,
    })
    const setB = node('div', {
      display: 'flex',
      alignItems: 'center',
      flexShrink: '0',
      columnGap: gap,
    })
    setB.setAttribute('aria-hidden', 'true')

    items.forEach((c) => setA.appendChild(c))

    track.appendChild(setA)
    track.appendChild(setB)
    this.appendChild(track)

    this.track = track
    this.setA = setA

    requestAnimationFrame(() => {
      this.fillSet(items)
      void this.play()
    })

    this.resizeObserver?.disconnect()
    this.resizeObserver = new ResizeObserver(() => this.onResize())
    this.resizeObserver.observe(this)
  }

  private fillSet(originals: HTMLElement[]) {
    if (!this.setA) return
    const containerW = this.offsetWidth
    if (!containerW) return
    let safety = 50
    while (this.setA.offsetWidth < containerW && safety-- > 0) {
      originals.forEach((c) => this.setA!.appendChild(c.cloneNode(true)))
    }
    const setB = this.setA.nextElementSibling as HTMLElement | null
    if (setB) {
      setB.replaceChildren()
      Array.from(this.setA.children).forEach((c) => setB.appendChild(c.cloneNode(true)))
    }
  }

  private startMarquee() {
    if (!this.track || !this.setA) return
    const w = this.setA.offsetWidth + this.gap
    if (!w) {
      requestAnimationFrame(() => this.startMarquee())
      return
    }

    this.ctrls?.stop()
    this.currentRate = 1
    this.targetRate = 1

    this.ctrls = animate(
      this.track,
      { x: this.direction === 'left' ? [0, -w] : [-w, 0] },
      { duration: w / this.speed, repeat: Infinity, ease: 'linear' },
    )

    this.removeEventListener('mouseenter', this.onEnter)
    this.removeEventListener('mouseleave', this.onLeave)
    this.removeEventListener('focus', this.onEnter)
    this.removeEventListener('blur', this.onLeave)
    this.removeEventListener('keydown', this.onKeyDown)

    if (this.pauseOnHover) {
      this.addEventListener('mouseenter', this.onEnter)
      this.addEventListener('mouseleave', this.onLeave)
    }

    this.addEventListener('focus', this.onEnter)
    this.addEventListener('blur', this.onLeave)
    this.addEventListener('keydown', this.onKeyDown)

    this.style.overflow = this.wave ? 'visible' : 'hidden'
    if (this.wave) {
      const setALeft = this.setA.getBoundingClientRect().left
      this.itemLocalPositions = (Array.from(this.setA.children) as HTMLElement[]).map((el) => {
        const r = el.getBoundingClientRect()
        return r.left + r.width / 2 - setALeft
      })
      this.startWave()
    } else {
      this.stopWave()
    }
  }

  private onResize() {
    if (!this.ctrls || !this.setA || !this.track) return
    const w = this.setA.offsetWidth + this.gap
    if (!w) return
    const elapsed = this.ctrls.time
    const oldDuration = w / this.speed
    const progress = (elapsed / oldDuration) % 1
    this.ctrls.stop()
    const newDuration = w / this.speed
    this.ctrls = animate(
      this.track,
      { x: this.direction === 'left' ? [0, -w] : [-w, 0] },
      { duration: newDuration, repeat: Infinity, ease: 'linear' },
    )
    this.ctrls.time = progress * newDuration
    this.ctrls.speed = this.currentRate
  }

  private resumeCtrls() {
    if (!this.ctrls) return
    const time = this.ctrls.time
    this.currentRate = Math.max(this.currentRate, MIN_RATE)
    this.ctrls.speed = this.currentRate
    this.ctrls.play()
    this.ctrls.time = time
  }

  private lerpRate(target: number) {
    this.targetRate = target
    if (this.rateRaf !== null) return

    const step = () => {
      if (!this.ctrls) {
        this.rateRaf = null
        return
      }
      const diff = this.targetRate - this.currentRate
      const stopped = this.targetRate === 0 && this.currentRate <= MIN_RATE
      if (stopped || Math.abs(diff) < 0.003) {
        this.rateRaf = null
        if (this.targetRate === 0) {
          this.currentRate = 0
          this.pause()
        } else {
          this.currentRate = this.targetRate
          this.ctrls.speed = this.currentRate
        }
        return
      }
      this.currentRate += diff * 0.1
      this.ctrls.speed = this.currentRate
      this.rateRaf = requestAnimationFrame(step)
    }
    this.rateRaf = requestAnimationFrame(step)
  }

  private onEnter = () => {
    this.lerpRate(0)
  }
  private onLeave = () => {
    if (this.playState === 'paused') void this.play()
    this.lerpRate(1)
  }

  private keyboardPaused = false

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== ' ' && e.key !== 'Enter') return
    e.preventDefault()
    if (this.keyboardPaused) {
      this.keyboardPaused = false
      if (this.playState === 'paused') void this.play()
      this.lerpRate(1)
    } else {
      this.keyboardPaused = true
      this.lerpRate(0)
    }
  }

  private startWave() {
    this.stopWave()
    const amp = this.waveAmplitude
    const wl = this.waveLength
    const phaseRate = (this.speed / wl) * Math.PI * 2 * (this.direction === 'right' ? -1 : 1)
    const setStride = (this.setA?.offsetWidth ?? 0) + this.gap
    let lastTime: number | null = null

    const step = (timestamp: number) => {
      if (!this.track) return
      if (lastTime !== null) this.wavePhase += phaseRate * ((timestamp - lastTime) / 1000)
      lastTime = timestamp

      Array.from(this.track.children).forEach((set, setIdx) => {
        const offset = setIdx * setStride
        ;(Array.from(set.children) as HTMLElement[]).forEach((item, i) => {
          const lx = (this.itemLocalPositions[i] ?? 0) + offset
          item.style.transform = `translateY(${amp * Math.sin((lx / wl) * Math.PI * 2 - this.wavePhase)}px)`
        })
      })
      this.waveRaf = requestAnimationFrame(step)
    }
    this.waveRaf = requestAnimationFrame(step)
  }

  private stopWave() {
    if (this.waveRaf !== null) {
      cancelAnimationFrame(this.waveRaf)
      this.waveRaf = null
    }
    if (this.track) {
      Array.from(this.track.children).forEach((set) =>
        Array.from(set.children).forEach((item) => ((item as HTMLElement).style.transform = '')),
      )
    }
  }
}

function node(tag: string, styles: Partial<CSSStyleDeclaration> = {}): HTMLElement {
  const el = document.createElement(tag)
  Object.assign(el.style, styles)
  return el
}

customElements.define('motion-ticker', MotionTicker)

declare global {
  interface HTMLElementTagNameMap {
    'motion-ticker': MotionTicker
  }
}
