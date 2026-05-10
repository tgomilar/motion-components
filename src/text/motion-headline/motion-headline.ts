import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { animate, stagger } from 'motion'
import { splitText } from '../utils/split-text.js'
import { useIntersect } from '../utils/use-intersect.js'
import type { MotionHeadlineProps, HeadlineBy, HeadlineVariant } from './motion-headline.types.js'

export type { MotionHeadlineProps, HeadlineBy, HeadlineVariant } from './motion-headline.types.js'

/**
 * Animated headline with split-text reveal. Splits the text content by
 * words, characters, or lines, then reveals each unit with a stagger.
 * `variant="slide"` slides each unit up under a mask; `variant="flip"`
 * flips each unit on the X axis with perspective.
 *
 * @element motion-headline
 *
 * @slot - The headline text. Plain text only — markup inside is replaced.
 *
 * @example
 * ```html
 * <motion-headline by="words" variant="slide" interval="0.08">
 *   Motion-first web components
 * </motion-headline>
 * ```
 */
@customElement('motion-headline')
export class MotionHeadline extends LitElement implements MotionHeadlineProps {
  /** Split unit: `'words'`, `'chars'`, or `'lines'`. */
  @property({ type: String, reflect: true }) by: HeadlineBy = 'words'
  /** Reveal style: `'slide'` (mask + slide up) or `'flip'` (3D rotateX). */
  @property({ type: String, reflect: true }) variant: HeadlineVariant = 'slide'
  /** Stagger between units, in seconds. */
  @property({ type: Number }) interval = 0.06
  /** Spring duration of each unit's reveal, in seconds. */
  @property({ type: Number }) duration = 1
  /** Delay before the first unit reveals, in seconds. */
  @property({ type: Number }) delay = 0
  /** IntersectionObserver threshold (0–1) at which the reveal triggers. */
  @property({ type: Number }) threshold = 0.2
  /** When `true`, only animate the first time the element enters view. */
  @property({ type: Boolean }) once = true

  static styles = css`
    :host {
      display: block;
    }
    :host(:not([data-ready])) {
      visibility: hidden;
    }
  `

  private units: HTMLElement[] = []
  private disconnectIntersect: (() => void) | null = null
  private revealed = false

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  firstUpdated() {
    const isFlip = this.variant === 'flip'

    if (isFlip) {
      this.buildFlip()
    } else {
      const { spans } = splitText(this, this.by, true)
      this.units = spans
    }

    if (!this.units.length) {
      this.setAttribute('data-ready', '')
      return
    }

    this.setAttribute('data-ready', '')

    this.disconnectIntersect = useIntersect(this, this.threshold, () => {
      if (!this.revealed) {
        this.play()
        if (this.once) {
          this.revealed = true
          this.disconnectIntersect?.()
        }
      }
    })
  }

  private buildFlip() {
    const originalText = this.textContent?.trim() ?? ''
    if (!originalText) return

    this.setAttribute('aria-label', originalText)

    const by = this.by === 'lines' ? 'words' : this.by

    this.style.perspective = '600px'

    if (by === 'chars') {
      const words = originalText.split(/\s+/)
      this.innerHTML = words
        .map((w) =>
          [...w]
            .map(
              (c) =>
                `<span style="display:inline-block;will-change:transform;transform:perspective(400px) rotateX(90deg);transform-origin:center bottom;opacity:0" aria-hidden="true">${c}</span>`,
            )
            .join(''),
        )
        .join(' ')
      this.units = [...this.querySelectorAll<HTMLElement>('span')]
      return
    }

    const units = originalText.split(/\s+/)

    this.innerHTML = units
      .map(
        (u) =>
          `<span style="display:inline-block;will-change:transform;transform:perspective(400px) rotateX(90deg);transform-origin:center bottom;opacity:0" aria-hidden="true">${u}</span>`,
      )
      .join(' ')

    this.units = [...this.querySelectorAll<HTMLElement>('span')]
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.disconnectIntersect?.()
  }

  private play() {
    if (this.reduced) {
      this.units.forEach((u) => {
        u.style.transform = ''
        u.style.opacity = '1'
      })
      return
    }

    if (this.variant === 'flip') {
      animate(
        this.units,
        { rotateX: [90, 0], opacity: [0, 1] },
        {
          delay: stagger(this.interval, { startDelay: this.delay }),
          duration: this.duration,
          type: 'spring',
          bounce: 0.1,
        },
      )
    } else {
      animate(
        this.units,
        { y: ['110%', '0%'] },
        {
          delay: stagger(this.interval, { startDelay: this.delay }),
          duration: this.duration,
          type: 'spring',
          bounce: 0.05,
        },
      )
    }
  }

  /** Resets and re-runs the headline reveal. */
  replay() {
    this.revealed = false
    if (this.variant === 'flip') {
      animate(this.units, { rotateX: 90, opacity: 0 }, { duration: 0 }).then(() => this.play())
    } else {
      animate(this.units, { y: '110%' }, { duration: 0 }).then(() => this.play())
    }
  }

  render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-headline': MotionHeadline
  }
}
