import { LitElement, html, css } from 'lit'
import { property } from 'lit/decorators.js'
import { animate, stagger } from 'motion'
import { Controllable, PlaybackController, controlsRun } from '../../utils/playback.js'
import { escapeHtml, screenReaderText, splitText, wordGroup } from '../utils/split-text.js'
import { useIntersect } from '../utils/use-intersect.js'
import type { MotionHeadlineProps, HeadlineBy, HeadlineVariant } from './motion-headline.types.js'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'

export type { MotionHeadlineProps, HeadlineBy, HeadlineVariant } from './motion-headline.types.js'

/**
 * Animated headline with split-text reveal. Splits the text content by
 * words, characters, or lines, then reveals each unit with a stagger.
 * `variant="slide"` slides each unit up under a mask; `variant="flip"`
 * flips each unit on the X axis with perspective.
 *
 * **Use it for:** page and section headings that reveal word by word, letter
 * by letter or line by line as they scroll into view.
 *
 * **Avoid it for:** headings with links or other markup, because the content
 * is replaced with plain text. For cards and images, use `motion-reveal`. For
 * lists, use `motion-stagger`.
 *
 * **Accessibility:** the split pieces are `aria-hidden`, and a visually hidden
 * span keeps the full text, so screen readers read it in one piece. The
 * element has no heading role, so put it inside a heading element such as
 * `<h2>`.
 *
 * **Reduced motion:** the text shows in its final place at once, with no
 * animation. The element does not wait to scroll into view.
 *
 * **Common mistakes:** using `by="lines"` where the width can change. The
 * lines are measured once, when the element first renders, and are not split
 * again on resize. Changing `by` or `variant` after the first render has no
 * effect. `variant="flip"` splits by words when `by="lines"`.
 *
 * @element motion-headline
 *
 * @fires motion-start - When a run starts.
 * @fires motion-finish - When a run finishes, or `finish()` jumps to the end.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
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
export class MotionHeadline extends Controllable(LitElement) implements MotionHeadlineProps {
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
  /** When `true`, only animate the first time the element enters view. Set `once="false"` to turn it off. */
  @property({ type: Boolean, converter: flag }) once = true

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

  playback: PlaybackController = new PlaybackController(this, {
    start: () =>
      this.variant === 'flip'
        ? controlsRun(
            animate(
              this.units,
              { rotateX: [90, 0], opacity: [0, 1] },
              {
                delay: stagger(this.interval, { startDelay: this.delay }),
                duration: this.duration,
                type: 'spring',
                bounce: 0.1,
              },
            ),
          )
        : controlsRun(
            animate(
              this.units,
              { y: ['110%', '0%'] },
              {
                delay: stagger(this.interval, { startDelay: this.delay }),
                duration: this.duration,
                type: 'spring',
                bounce: 0.05,
              },
            ),
          ),
    applyFinalState: () => {
      for (const u of this.units) {
        u.style.transform = ''
        u.style.opacity = '1'
      }
    },
    applyInitialState: () => {
      for (const u of this.units) {
        if (this.variant === 'flip') {
          u.style.transform = 'perspective(400px) rotateX(90deg)'
          u.style.opacity = '0'
        } else {
          u.style.transform = 'translateY(110%)'
        }
      }
    },
  })

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

    if (this.reduced) {
      this.finish()
      return
    }

    this.disconnectIntersect = useIntersect(
      this,
      this.threshold,
      () => {
        if (!this.revealed && this.playState === 'idle') {
          void this.play()
          if (this.once) {
            this.revealed = true
            this.disconnectIntersect?.()
          }
        }
      },
      () => {
        if (!this.once && this.playState !== 'idle') this.cancel()
      },
    )
  }

  private buildFlip() {
    const originalText = this.textContent?.trim() ?? ''
    if (!originalText) return

    const by = this.by === 'lines' ? 'words' : this.by
    const words = originalText.split(/\s+/)

    this.style.perspective = '600px'

    const unit = (text: string) =>
      `<span data-unit style="display:inline-block;will-change:transform;transform:perspective(400px) rotateX(90deg);transform-origin:center bottom;opacity:0" aria-hidden="true">${escapeHtml(text)}</span>`
    const pieces = by === 'chars' ? words.map((w) => wordGroup(w, unit)) : words.map(unit)

    this.innerHTML = screenReaderText(originalText) + pieces.join(' ')
    this.units = [...this.querySelectorAll<HTMLElement>('[data-unit]')]
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.disconnectIntersect?.()
  }

  /** Resets and re-runs the headline reveal. */
  replay() {
    this.revealed = false
    this.cancel()
    void this.play()
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
