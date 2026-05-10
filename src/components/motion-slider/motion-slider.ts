import { animate } from 'motion'
import type { AnimationPlaybackControls } from 'motion'
export type { MotionSliderProps } from './motion-slider.types.js'

/**
 * Horizontal slider with spring-snap drag, arrow-button navigation, and dot indicators.
 * Slides snap to full-viewport-width positions on release. Responsive to container resize.
 *
 * @element motion-slider
 *
 * @slot - Slides. Each direct child becomes a slide in the carousel.
 *
 * @property {number} gap - Space between slides in pixels. Default `24`.
 * @property {boolean} arrows - Whether to show prev/next arrow buttons. Default `true`.
 *
 * @fires slidechange - Dispatched when the active slide index changes.
 *   `event.detail.index` contains the new index.
 *
 * @example
 * ```html
 * <motion-slider gap="24" arrows>
 *   <div>Slide 1</div>
 *   <div>Slide 2</div>
 *   <div>Slide 3</div>
 * </motion-slider>
 * ```
 */
export class MotionSlider extends HTMLElement {
  static observedAttributes = ['gap', 'arrows']

  private track: HTMLElement | null = null
  private slides: HTMLElement[] = []
  private dots: HTMLElement[] = []
  private arrows: [HTMLElement, HTMLElement] | null = null
  private anim: AnimationPlaybackControls | null = null
  private index = 0
  private built = false
  private lastW = 0
  private ro: ResizeObserver | null = null

  private dragging = false
  private startX = 0
  private baseOffset = 0
  private samples: Array<{ x: number; t: number }> = []

  private get gap(): number {
    return Number(this.getAttribute('gap') ?? 24)
  }
  private get showArrows(): boolean {
    return this.getAttribute('arrows') !== 'false'
  }
  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  connectedCallback() {
    Object.assign(this.style, {
      display: 'block',
      position: 'relative',
      overflow: 'hidden',
    })
    this.tryBuild()
  }

  disconnectedCallback() {
    this.track?.removeEventListener('pointerdown', this.onDown)
    window.removeEventListener('pointermove', this.onMove)
    window.removeEventListener('pointerup', this.onUp)
    window.removeEventListener('pointercancel', this.onUp)
    this.removeEventListener('keydown', this.onKey)
    this.ro?.disconnect()
  }

  private tryBuild() {
    const w = this.offsetWidth
    if (!w) {
      requestAnimationFrame(() => this.tryBuild())
      return
    }
    this.build(w)
  }

  private build(sliderW: number) {
    if (this.built) return
    this.built = true
    this.lastW = sliderW

    const items = Array.from(this.children) as HTMLElement[]
    if (!items.length) return

    const track = node('div', {
      display: 'flex',
      gap: `${this.gap}px`,
      cursor: 'grab',
      userSelect: 'none',
      touchAction: 'pan-y',
      willChange: 'transform',
    })
    items.forEach((item) => {
      Object.assign(item.style, {
        flex: `0 0 ${sliderW}px`,
        minWidth: '0',
        boxSizing: 'border-box',
      })
      track.appendChild(item)
    })
    this.appendChild(track)
    this.track = track
    this.slides = Array.from(track.children) as HTMLElement[]

    if (this.showArrows && this.slides.length > 1) {
      const prev = this.makeArrow('prev')
      const next = this.makeArrow('next')
      this.appendChild(prev)
      this.appendChild(next)
      this.arrows = [prev, next]
    }

    if (this.slides.length > 1) {
      const dotsWrap = node('div', {
        position: 'absolute',
        bottom: '16px',
        left: '0',
        right: '0',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '6px',
        zIndex: '10',
        pointerEvents: 'none',
      })
      this.slides.forEach((_, i) => {
        const dot = node('div', {
          width: i === 0 ? '22px' : '6px',
          height: '6px',
          borderRadius: '99px',
          background: i === 0 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.3)',
          transition: 'width 0.3s ease, background 0.25s ease',
          pointerEvents: 'auto',
          cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        })
        dot.addEventListener('click', () => this.goTo(i))
        dotsWrap.appendChild(dot)
        this.dots.push(dot)
      })
      this.appendChild(dotsWrap)
    }

    track.addEventListener('pointerdown', this.onDown)
    window.addEventListener('pointermove', this.onMove, { passive: true })
    window.addEventListener('pointerup', this.onUp)
    window.addEventListener('pointercancel', this.onUp)
    this.tabIndex = 0
    this.addEventListener('keydown', this.onKey)

    this.ro = new ResizeObserver(() => this.onResize())
    this.ro.observe(this)

    this.updateArrows()
  }

  private onResize() {
    const w = this.offsetWidth
    if (!w || w === this.lastW || !this.track) return
    this.lastW = w

    this.slides.forEach((slide) => {
      slide.style.flex = `0 0 ${w}px`
      slide.style.boxSizing = 'border-box'
    })
    this.anim?.stop()
    this.writeOffset(-this.index * this.slideW())
  }

  private makeArrow(dir: 'prev' | 'next'): HTMLElement {
    const btn = document.createElement('button')
    Object.assign(btn.style, {
      all: 'unset',
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
      [dir === 'prev' ? 'left' : 'right']: '12px',
      zIndex: '10',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '36px',
      height: '36px',
      borderRadius: '50%',
      background: 'rgba(0,0,0,0.45)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,0.15)',
      color: '#fff',
      cursor: 'pointer',
      boxSizing: 'border-box',
      transition: 'background 0.18s, transform 0.18s, opacity 0.18s',
      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
    })
    btn.innerHTML = dir === 'prev' ? chevron('left') : chevron('right')
    btn.setAttribute('aria-label', dir === 'prev' ? 'Previous slide' : 'Next slide')
    btn.addEventListener('click', () => {
      this.goTo(this.index + (dir === 'prev' ? -1 : 1))
    })
    btn.addEventListener('mouseenter', () => {
      if (btn.style.opacity === '0.3') return
      btn.style.background = 'rgba(0,0,0,0.65)'
      btn.style.transform = `translateY(-50%) scale(1.08)`
    })
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(0,0,0,0.45)'
      btn.style.transform = 'translateY(-50%) scale(1)'
    })
    return btn
  }

  private onDown = (e: PointerEvent) => {
    this.dragging = true
    this.startX = e.clientX
    this.baseOffset = this.readOffset()
    this.samples = [{ x: e.clientX, t: performance.now() }]
    this.anim?.stop()
    this.track!.style.cursor = 'grabbing'
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  private onMove = (e: PointerEvent) => {
    if (!this.dragging) return
    const delta = e.clientX - this.startX
    this.writeOffset(this.resist(this.baseOffset + delta))
    this.samples.push({ x: e.clientX, t: performance.now() })
    if (this.samples.length > 6) this.samples.shift()
  }

  private onUp = () => {
    if (!this.dragging) return
    this.dragging = false
    if (this.track) this.track.style.cursor = 'grab'
    this.snap(this.velocity())
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') this.goTo(this.index - 1)
    if (e.key === 'ArrowRight') this.goTo(this.index + 1)
  }

  private slideW(): number {
    return (this.slides[0]?.offsetWidth ?? 0) + this.gap
  }

  private readOffset(): number {
    return new DOMMatrix(getComputedStyle(this.track!).transform).m41
  }

  private writeOffset(x: number) {
    this.track!.style.transform = `translateX(${x}px)`
  }

  private resist(x: number): number {
    const sw = this.slideW()
    const min = -(this.slides.length - 1) * sw
    if (x > 0) return Math.sqrt(x) * 12
    if (x < min) return min - Math.sqrt(min - x) * 12
    return x
  }

  private velocity(): number {
    const s = this.samples
    if (s.length < 2) return 0
    const dt = s[s.length - 1].t - s[0].t
    return dt < 1 ? 0 : (s[s.length - 1].x - s[0].x) / dt
  }

  private snap(velPxMs: number) {
    const sw = this.slideW()
    if (!sw) return
    const offset = this.readOffset()
    const FLICK = 0.3
    let target: number
    if (velPxMs < -FLICK) target = Math.min(this.slides.length - 1, this.index + 1)
    else if (velPxMs > FLICK) target = Math.max(0, this.index - 1)
    else target = Math.round(-offset / sw)
    this.goTo(Math.max(0, Math.min(this.slides.length - 1, target)), velPxMs * 1000)
  }

  /** Navigate to the slide at `index`. Pass `initialVelocity` (px/ms) for a flick-snap feel. */
  goTo(index: number, initialVelocity = 0) {
    this.index = Math.max(0, Math.min(this.slides.length - 1, index))
    const targetX = -this.index * this.slideW()

    this.anim?.stop()
    if (this.reduced) {
      this.writeOffset(targetX)
    } else {
      this.anim = animate(
        this.track!,
        { x: targetX },
        { type: 'spring', stiffness: 360, damping: 42, velocity: initialVelocity },
      )
    }
    this.updateDots()
    this.updateArrows()
    this.dispatchEvent(
      new CustomEvent('slidechange', { detail: { index: this.index }, bubbles: true }),
    )
  }

  private updateDots() {
    this.dots.forEach((dot, i) => {
      const active = i === this.index
      dot.style.width = active ? '22px' : '6px'
      dot.style.background = active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.3)'
    })
  }

  private updateArrows() {
    if (!this.arrows) return
    const [prev, next] = this.arrows
    prev.style.opacity = this.index === 0 ? '0.3' : '1'
    prev.style.pointerEvents = this.index === 0 ? 'none' : 'auto'
    next.style.opacity = this.index === this.slides.length - 1 ? '0.3' : '1'
    next.style.pointerEvents = this.index === this.slides.length - 1 ? 'none' : 'auto'
  }
}

function node(tag: string, styles: Partial<CSSStyleDeclaration> = {}): HTMLElement {
  const el = document.createElement(tag)
  Object.assign(el.style, styles)
  return el
}

function chevron(dir: 'left' | 'right'): string {
  const pts = dir === 'left' ? '15 18 9 12 15 6' : '9 6 15 12 9 18'
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="${pts}"></polyline></svg>`
}

customElements.define('motion-slider', MotionSlider)

declare global {
  interface HTMLElementTagNameMap {
    'motion-slider': MotionSlider
  }
}
