import { animate } from 'motion'
import type { AnimationPlaybackControls } from 'motion'
import '../../respond/motion-hover/motion-hover.js'
import '../../reveal/motion-stagger/motion-stagger.js'
export type { MotionGalleryProps } from './motion-gallery.types.js'

const SPRING_EXPAND = { type: 'spring', stiffness: 380, damping: 40, restDelta: 0.001 } as const
const SPRING_COLLAPSE = { type: 'spring', stiffness: 460, damping: 48, restDelta: 0.001 } as const

/**
 * Image gallery with a spring-animated expand/collapse lightbox. Grid layout with
 * hover scaling on each item. Opens a full-viewport lightbox with prev/next navigation,
 * keyboard support, and focus trapping.
 *
 * @element motion-gallery
 *
 * @slot - Gallery items. Each item should have a unique `data-caption` for the
 *   lightbox caption overlay (optional). Items are expected to be images or media
 *   elements.
 *
 * @property {string} columns - Number of grid columns. Default `"3"`.
 * @property {number} gap - Grid gap in pixels. Default `16`.
 * @property {string} aspect-ratio - CSS aspect-ratio for each item.
 * @property {boolean} stagger - Whether to stagger entrance. Set `"false"` to disable. Default `true`.
 *
 * @example
 * ```html
 * <motion-gallery columns="3" gap="16" aspect-ratio="4/3">
 *   <img src="photo-1.jpg" alt="Photo 1" data-caption="Sunset view" />
 *   <img src="photo-2.jpg" alt="Photo 2" data-caption="Mountain trail" />
 *   <img src="photo-3.jpg" alt="Photo 3" />
 * </motion-gallery>
 * ```
 */
export class MotionGallery extends HTMLElement {
  static observedAttributes = ['columns', 'gap', 'aspect-ratio', 'stagger']

  private items: HTMLElement[] = []
  private backdrop: HTMLElement | null = null
  private controls: HTMLElement | null = null
  private clone: HTMLElement | null = null
  private expandAnim: AnimationPlaybackControls | null = null
  private active: HTMLElement | null = null
  private currentIndex = -1
  private lastFocus: HTMLElement | null = null
  private brCache = new WeakMap<HTMLElement, string>()

  private hoverWrappers: HTMLElement[] = []
  private prevBtn: HTMLButtonElement | null = null
  private nextBtn: HTMLButtonElement | null = null
  private closeBtn: HTMLButtonElement | null = null
  private counterEl: HTMLElement | null = null
  private captionEl: HTMLElement | null = null
  private initialized = false

  private get columns() {
    return this.getAttribute('columns') ?? '3'
  }
  private get gap() {
    return Number(this.getAttribute('gap') ?? 16)
  }
  private get aspectRatio() {
    return this.getAttribute('aspect-ratio') ?? ''
  }
  private get showStagger() {
    return this.getAttribute('stagger') !== 'false'
  }
  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  connectedCallback() {
    if (this.initialized) return
    this.initialized = true

    this.setAttribute('role', 'group')
    this.setAttribute('aria-label', 'Image gallery')

    Object.assign(this.style, {
      display: 'grid',
      gridTemplateColumns: `repeat(${this.columns}, 1fr)`,
      gap: `${this.gap}px`,
      contain: 'layout style',
    })

    // eslint-disable-next-line wc/no-child-traversal-in-connectedcallback
    this.items = Array.from(this.children) as HTMLElement[]
    if (!this.items.length) return

    this.items.forEach((item, i) => {
      item.setAttribute('tabindex', '0')
      item.setAttribute('role', 'button')
      item.setAttribute('aria-haspopup', 'dialog')
      item.setAttribute(
        'aria-label',
        item.dataset.caption ?? `Open item ${i + 1} of ${this.items.length}`,
      )
      item.style.cursor = 'zoom-in'
      item.style.transformOrigin = 'center'
      item.style.display = 'block'
      item.style.width = '100%'
      if (this.aspectRatio) item.style.aspectRatio = this.aspectRatio
      this.brCache.set(item, getComputedStyle(item).borderRadius || '4px')

      const hover = document.createElement('motion-hover')
      hover.setAttribute('scale', '1.03')
      hover.setAttribute('y', '-4')
      hover.setAttribute('bounce', '0.1')
      hover.style.display = 'block'
      this.hoverWrappers.push(hover)
      item.replaceWith(hover)
      hover.appendChild(item)
    })

    this.addEventListener('click', this.onClick)
    this.addEventListener('keydown', this.onItemKey)

    if (this.showStagger) {
      const staggerEl = document.createElement('motion-stagger')
      staggerEl.setAttribute('interval', '0.055')
      staggerEl.setAttribute('duration', '0.6')
      staggerEl.setAttribute('y', '16')
      this.hoverWrappers.forEach((w) => staggerEl.appendChild(w))
      this.appendChild(staggerEl)
    }
  }

  disconnectedCallback() {
    this.backdrop?.remove()
    this.controls?.remove()
    document.removeEventListener('keydown', this.onKey)
    this.removeEventListener('click', this.onClick)
    this.removeEventListener('keydown', this.onItemKey)
    this.expandAnim?.stop()
    this.expandAnim = null
    this.clone?.remove()
    this.clone = null
    this.active = null
    this.backdrop = null
    this.controls = null
  }

  attributeChangedCallback() {
    if (!this.initialized) return
    Object.assign(this.style, {
      gridTemplateColumns: `repeat(${this.columns}, 1fr)`,
      gap: `${this.gap}px`,
    })
    if (this.aspectRatio) {
      this.items.forEach((item) => {
        item.style.aspectRatio = this.aspectRatio
      })
    }
  }

  private onClick = (e: Event) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('[role="button"]')
    if (item && this.items.includes(item)) this.expand(item)
  }

  private onItemKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    const item = (e.target as HTMLElement).closest<HTMLElement>('[role="button"]')
    if (item && this.items.includes(item)) {
      e.preventDefault()
      this.expand(item)
    }
  }

  private ensureOverlay() {
    if (this.backdrop) return
    this.backdrop = this.buildBackdrop()
    this.controls = this.buildControls()
    document.body.appendChild(this.backdrop)
    document.body.appendChild(this.controls)
  }

  private buildBackdrop(): HTMLElement {
    const el = document.createElement('div')
    Object.assign(el.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(0,0,0,0.82)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      zIndex: '9998',
      opacity: '0',
      display: 'none',
    })
    el.addEventListener('click', () => this.collapse())
    return el
  }

  private buildControls(): HTMLElement {
    const el = document.createElement('div')
    el.setAttribute('role', 'dialog')
    el.setAttribute('aria-modal', 'true')
    el.setAttribute('aria-label', 'Image lightbox')
    Object.assign(el.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '10000',
      display: 'none',
      pointerEvents: 'none',
    })

    const close = this.buildBtn('✕', { top: '1.25rem', right: '1.25rem' }, 'Close lightbox')
    close.addEventListener('click', () => this.collapse())
    el.appendChild(close)
    this.closeBtn = close

    const prev = this.buildBtn(
      '←',
      { left: '1.25rem', top: '50%', transform: 'translateY(-50%)' },
      'Previous item',
    )
    prev.addEventListener('click', () => this.prev())
    el.appendChild(prev)
    this.prevBtn = prev

    const next = this.buildBtn(
      '→',
      { right: '1.25rem', top: '50%', transform: 'translateY(-50%)' },
      'Next item',
    )
    next.addEventListener('click', () => this.next())
    el.appendChild(next)
    this.nextBtn = next

    const counter = document.createElement('div')
    counter.setAttribute('aria-live', 'polite')
    counter.setAttribute('aria-atomic', 'true')
    Object.assign(counter.style, {
      position: 'absolute',
      bottom: '1.25rem',
      left: '50%',
      transform: 'translateX(-50%)',
      color: 'rgba(255,255,255,0.5)',
      fontSize: '0.78rem',
      fontFamily: 'ui-monospace, monospace',
      letterSpacing: '0.08em',
    })
    el.appendChild(counter)
    this.counterEl = counter

    const caption = document.createElement('div')
    Object.assign(caption.style, {
      position: 'absolute',
      bottom: '2.75rem',
      left: '50%',
      transform: 'translateX(-50%)',
      color: 'rgba(255,255,255,0.85)',
      fontSize: '0.92rem',
      textAlign: 'center',
      maxWidth: '560px',
      display: 'none',
    })
    el.appendChild(caption)
    this.captionEl = caption

    return el
  }

  private buildBtn(
    label: string,
    pos: Partial<CSSStyleDeclaration>,
    ariaLabel: string,
  ): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.textContent = label
    btn.setAttribute('aria-label', ariaLabel)
    Object.assign(btn.style, {
      position: 'absolute',
      pointerEvents: 'auto',
      background: 'rgba(255,255,255,0.1)',
      border: '1px solid rgba(255,255,255,0.16)',
      backdropFilter: 'blur(12px)',
      color: '#fff',
      width: '2.5rem',
      height: '2.5rem',
      borderRadius: '50%',
      fontSize: '1rem',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background 0.15s, outline 0.15s',
      outline: '2px solid transparent',
      outlineOffset: '2px',
      ...pos,
    })
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(255,255,255,0.2)'
    })
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(255,255,255,0.1)'
    })
    btn.addEventListener('focus-visible', () => {
      btn.style.outline = '2px solid rgba(255,255,255,0.6)'
    })
    btn.addEventListener('blur', () => {
      btn.style.outline = '2px solid transparent'
    })
    return btn
  }

  private open() {
    this.backdrop!.style.display = 'block'
    this.controls!.style.display = 'block'
    animate(
      this.backdrop!,
      { opacity: [0, 1] },
      { type: 'spring', bounce: 0, duration: this.reduced ? 0 : 0.3 },
    )
    document.addEventListener('keydown', this.onKey)
  }

  private hide() {
    document.removeEventListener('keydown', this.onKey)
    animate(
      this.backdrop!,
      { opacity: 0 },
      { type: 'spring', bounce: 0, duration: this.reduced ? 0 : 0.22 },
    ).then(() => {
      this.backdrop!.style.display = 'none'
    })
    this.controls!.style.display = 'none'
  }

  private expand(item: HTMLElement) {
    if (this.active) return
    if (!this.items.length) return
    this.ensureOverlay()
    this.lastFocus = document.activeElement as HTMLElement
    this.active = item
    this.currentIndex = this.items.indexOf(item)
    this.hoverWrappers.forEach((w) => {
      w.style.pointerEvents = 'none'
    })

    const first = item.getBoundingClientRect()
    const { x: tx, y: ty, w: tw, h: th } = this.targetRect(first)

    this.open()

    const fromBR = this.brCache.get(item) ?? '4px'
    const clone = this.makeClone(item, first.left, first.top, first.width, first.height)
    clone.style.borderRadius = fromBR
    document.body.appendChild(clone)
    this.clone = clone
    item.style.opacity = '0'

    if (!this.reduced) {
      this.expandAnim = animate(
        clone,
        { left: tx, top: ty, width: tw, height: th, borderRadius: '16px' },
        SPRING_EXPAND,
      )
    }

    clone.addEventListener('click', () => this.collapse())
    requestAnimationFrame(() => this.closeBtn?.focus())
    this.updateUI()
  }

  private collapse() {
    const clone = this.clone
    const item = this.active
    if (!clone || !item) return

    const returning = this.lastFocus
    this.active = null
    this.clone = null
    this.currentIndex = -1
    this.lastFocus = null
    this.hoverWrappers.forEach((w) => {
      w.style.pointerEvents = ''
    })

    this.hide()
    this.expandAnim?.stop()
    this.expandAnim = null

    if (this.reduced) {
      clone.remove()
      item.style.opacity = ''
      returning?.focus()
      return
    }

    const itemRect = item.getBoundingClientRect()
    const toBR = this.brCache.get(item) ?? '4px'

    const collapseAnim = animate(
      clone,
      {
        left: itemRect.left,
        top: itemRect.top,
        width: itemRect.width,
        height: itemRect.height,
        borderRadius: toBR,
      },
      SPRING_COLLAPSE,
    )
    collapseAnim.then(() => {
      clone.remove()
      item.style.opacity = ''
    })

    returning?.focus()
  }

  private prev() {
    if (this.currentIndex > 0) this.navigateTo(this.currentIndex - 1)
  }

  private next() {
    if (this.currentIndex < this.items.length - 1) this.navigateTo(this.currentIndex + 1)
  }

  private navigateTo(newIndex: number) {
    const clone = this.clone
    const item = this.active
    if (!clone || !item) return

    this.expandAnim?.stop()
    this.expandAnim = null
    this.active = null
    this.clone = null
    this.currentIndex = newIndex
    item.style.opacity = ''

    const nextItem = this.items[newIndex]
    const nextFirst = nextItem.getBoundingClientRect()
    const { x: tx, y: ty, w: tw, h: th } = this.targetRect(nextFirst)

    clone.remove()

    const nextClone = this.makeClone(nextItem, tx, ty, tw, th)
    nextClone.style.opacity = '0'
    document.body.appendChild(nextClone)
    nextItem.style.opacity = '0'
    this.active = nextItem
    this.clone = nextClone

    if (!this.reduced) {
      animate(
        nextClone,
        { opacity: [0, 1], scale: [1.04, 1] },
        { type: 'spring', bounce: 0.1, duration: 0.32 },
      )
    } else {
      nextClone.style.opacity = '1'
    }

    nextClone.addEventListener('click', () => this.collapse())
    this.updateUI()
  }

  private makeClone(item: HTMLElement, l: number, t: number, w: number, h: number): HTMLElement {
    const clone = item.cloneNode(true) as HTMLElement
    clone.removeAttribute('tabindex')
    clone.removeAttribute('role')
    clone.removeAttribute('aria-haspopup')
    Object.assign(clone.style, {
      position: 'fixed',
      left: `${l}px`,
      top: `${t}px`,
      width: `${w}px`,
      height: `${h}px`,
      margin: '0',
      zIndex: '9999',
      cursor: 'zoom-out',
      borderRadius: '16px',
      boxSizing: 'border-box',
      transition: 'none',
      overflow: 'hidden',
      willChange: 'transform',
    })
    return clone
  }

  private updateUI() {
    const total = this.items.length
    const i = this.currentIndex

    if (this.counterEl) this.counterEl.textContent = `${i + 1} / ${total}`

    if (this.prevBtn) {
      const disabled = i === 0
      this.prevBtn.style.opacity = disabled ? '0.3' : '1'
      this.prevBtn.disabled = disabled
      this.prevBtn.setAttribute('aria-disabled', String(disabled))
    }
    if (this.nextBtn) {
      const disabled = i === total - 1
      this.nextBtn.style.opacity = disabled ? '0.3' : '1'
      this.nextBtn.disabled = disabled
      this.nextBtn.setAttribute('aria-disabled', String(disabled))
    }

    const caption = this.items[i]?.dataset.caption ?? ''
    if (this.captionEl) {
      this.captionEl.textContent = caption
      this.captionEl.style.display = caption ? 'block' : 'none'
    }
  }

  private targetRect(first: DOMRect) {
    const pad = 80
    const vw = window.innerWidth
    const vh = window.innerHeight
    const maxW = vw - pad * 2
    const maxH = vh - pad * 2
    const aspect = first.width / first.height
    let tw = maxW
    let th = tw / aspect
    if (th > maxH) {
      th = maxH
      tw = th * aspect
    }
    return { x: (vw - tw) / 2, y: (vh - th) / 2, w: tw, h: th }
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.collapse()
      return
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      this.next()
      return
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      this.prev()
      return
    }

    if (e.key === 'Tab') {
      const focusable = [this.closeBtn, this.prevBtn, this.nextBtn].filter(
        (b): b is HTMLButtonElement => b !== null && !b.disabled,
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
  }
}

customElements.define('motion-gallery', MotionGallery)

declare global {
  interface HTMLElementTagNameMap {
    'motion-gallery': MotionGallery
  }
}
