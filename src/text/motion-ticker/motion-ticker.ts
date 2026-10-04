import { animate } from 'motion'
import type { AnimationPlaybackControls } from 'motion'
import { Controllable, PlaybackController } from '../../utils/playback.js'
import type { MotionTickerProps, TickerDirection } from './motion-ticker.types.js'
import { BaseElement, defineElement } from '../../utils/define.js'
import { readFlag } from '../../utils/attributes.js'

export type { MotionTickerProps, TickerDirection } from './motion-ticker.types.js'

const MIN_RATE = 0.05

/**
 * Horizontal auto-scrolling ticker / marquee. Duplicates children to create a
 * seamless infinite loop. Supports pause-on-hover, keyboard pause (Space/Enter),
 * direction control, and an optional sine-wave vertical oscillation effect.
 *
 * **Use it for:** a looping strip of short items, such as logos, tags or
 * news headlines, that moves sideways across the page on its own.
 *
 * **Avoid it for:** links, buttons and other controls: only the original
 * items can be clicked or focused, not the copies, and the ticker keeps
 * moving while one of them has focus. Also avoid it for content people must
 * read in full. For items that people move through themselves, use
 * `motion-slider`.
 *
 * **Accessibility:** the ticker is focusable (`tabindex="0"`) and has
 * `role="region"` with the `aria-label` "Scrolling ticker. Press Space to
 * pause.", which replaces any `aria-label` you set in the HTML. Hover (with
 * `pause-on-hover`) and focus slow it to a stop. When the ticker itself has
 * focus, Space or Enter pauses it until one of them is pressed again. Key
 * presses on items inside it are left alone. Every copy of the items is
 * `aria-hidden` and `inert`, so screen readers read each item once and Tab
 * reaches only the original items.
 *
 * **Reduced motion:** the ticker is not built and does not move. The items
 * stay in normal flow, with no copies and no `gap`. It gets no `tabindex`,
 * role or label, because there is nothing to pause.
 *
 * **Common mistakes:** putting bare text directly inside: only child elements
 * become items, so wrap each item in an element such as `<span>`. With
 * `wave`, the ticker does not clip its content, so the items can show past
 * its edges and make the page scroll sideways; put it in a parent with
 * `overflow-x: clip`.
 *
 * @element motion-ticker
 *
 * @fires motion-start - When a run starts.
 * @fires motion-finish - When a run finishes, or `finish()` jumps to the end.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
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
export class MotionTicker extends Controllable(BaseElement) {
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
  private originalItems: HTMLElement[] = []

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
    return readFlag(this, 'pause-on-hover', true)
  }
  private get wave(): MotionTickerProps['wave'] {
    return readFlag(this, 'wave', false)
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
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    this.setAttribute('tabindex', '0')
    this.setAttribute('role', 'region')
    this.setAttribute('aria-label', 'Scrolling ticker. Press Space to pause.')
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
    this.rebuildMarquee()
  }

  private build() {
    const items = Array.from(this.children) as HTMLElement[]
    if (!items.length) return
    this.originalItems = items

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
    })
    const setB = node('div', {
      display: 'flex',
      alignItems: 'center',
      flexShrink: '0',
    })
    setB.setAttribute('aria-hidden', 'true')
    setB.inert = true

    items.forEach((c) => setA.appendChild(c))

    track.appendChild(setA)
    track.appendChild(setB)
    this.appendChild(track)

    this.track = track
    this.setA = setA
    this.applyGap()

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
    let grown = false
    while (this.setA.offsetWidth < containerW && safety-- > 0) {
      originals.forEach((c) => this.setA!.appendChild(copyOf(c)))
      grown = true
    }
    const setB = this.setA.nextElementSibling as HTMLElement | null
    if (setB && (grown || setB.childElementCount !== this.setA.childElementCount)) {
      setB.replaceChildren()
      Array.from(this.setA.children).forEach((c) => setB.appendChild(c.cloneNode(true)))
    }
  }

  private startMarquee() {
    if (!this.track || !this.setA) return
    this.applyGap()
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

    this.refreshWave()
  }

  private refreshWave() {
    if (!this.setA) return
    this.style.overflow = this.wave ? 'visible' : 'hidden'
    if (!this.wave) {
      this.stopWave()
      return
    }
    const setALeft = this.setA.getBoundingClientRect().left
    this.itemLocalPositions = (Array.from(this.setA.children) as HTMLElement[]).map((el) => {
      const r = el.getBoundingClientRect()
      return r.left + r.width / 2 - setALeft
    })
    // While paused the wave loop stays down; resume restarts it and picks up
    // the freshly measured positions.
    if (this.playState === 'running') this.startWave()
  }

  private onResize() {
    this.rebuildMarquee()
  }

  /**
   * Rebuilds the animation against the current attribute values and geometry,
   * carrying over the rendered position, rate and the pause state. `speed` is
   * floored at MIN_RATE like `resumeCtrls()`, since a running animation at
   * speed 0 reads back `time` as 0 and would lose the position on the next
   * resume.
   */
  private applyGap() {
    if (!this.setA) return
    const gap = `${this.gap}px`
    this.setA.style.columnGap = gap
    this.setA.style.marginRight = gap
    const setB = this.setA.nextElementSibling as HTMLElement | null
    if (setB) setB.style.columnGap = gap
  }

  private rebuildMarquee() {
    if (this.playState !== 'running' && this.playState !== 'paused') return
    if (!this.ctrls || !this.setA || !this.track) return
    this.applyGap()
    this.fillSet(this.originalItems)
    const w = this.setA.offsetWidth + this.gap
    if (!w) return
    // The new time is derived from the rendered offset rather than the old
    // animation's clock, so the track holds its place even when the duration
    // or direction it would be measured against has just changed.
    const progress = this.renderedProgress(w)
    this.ctrls.stop()
    const duration = w / this.speed
    this.ctrls = animate(
      this.track,
      { x: this.direction === 'left' ? [0, -w] : [-w, 0] },
      { duration, repeat: Infinity, ease: 'linear' },
    )
    // Reading `duration` flushes motion's async keyframe resolver; before
    // that, assigning `time` cannot rebase the running animation and play()
    // would restart it from 0 on the next frame.
    void this.ctrls.duration
    this.ctrls.speed = Math.max(this.currentRate, MIN_RATE)
    // The playback controller already reports 'paused', so its pause() is a
    // no-op here — the freshly built animation has to be held directly.
    if (this.playState === 'paused') this.ctrls.pause()
    this.ctrls.time = progress * duration
    this.refreshWave()
  }

  private renderedProgress(w: number): number {
    const transform = getComputedStyle(this.track!).transform
    if (transform === 'none') return 0
    const x = new DOMMatrix(transform).m41
    const p = this.direction === 'left' ? -x / w : x / w + 1
    return ((p % 1) + 1) % 1
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
    // A keyboard pause is an explicit request; the pointer or focus wandering
    // off must not override it. Space lifts it again.
    if (this.keyboardPaused) return
    if (this.playState === 'paused') void this.play()
    this.lerpRate(1)
  }

  private keyboardPaused = false

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.target !== this || (e.key !== ' ' && e.key !== 'Enter')) return
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

function copyOf(item: HTMLElement): HTMLElement {
  const copy = item.cloneNode(true) as HTMLElement
  copy.setAttribute('aria-hidden', 'true')
  copy.inert = true
  return copy
}

defineElement('motion-ticker', MotionTicker)

declare global {
  interface HTMLElementTagNameMap {
    'motion-ticker': MotionTicker
  }
}
