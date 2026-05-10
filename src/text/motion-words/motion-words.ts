import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { animate } from 'motion'
import type { MotionWordsProps } from './motion-words.types.js'

export type { MotionWordsProps } from './motion-words.types.js'

/**
 * Rotating word swap. Cycles through a comma-separated list of `words`,
 * springing the host width between values and crossfading each word with
 * a translate + blur transition. Optional per-word `colors` list.
 *
 * @element motion-words
 *
 * @example
 * ```html
 * <motion-words
 *   words="ship, design, animate"
 *   colors="#2563eb, #db2777, #16a34a"
 *   interval="2000">
 * </motion-words>
 * ```
 */
@customElement('motion-words')
export class MotionWords extends LitElement implements MotionWordsProps {
  /** Comma-separated list of words to cycle through. */
  @property({ type: String }) words = ''
  /** Comma-separated list of CSS colors, one per word. Optional. */
  @property({ type: String }) colors = ''
  /** Time each word stays visible, in milliseconds. */
  @property({ type: Number }) interval = 2000
  /** Reserved; transitions are spring-based and not duration-driven. */
  @property({ type: Number }) duration = 0.5

  @state() private index = 0

  static styles = css`
    :host {
      display: inline-block;
      overflow: hidden;
      vertical-align: bottom;
      font-size: inherit;
      font-weight: inherit;
      font-family: inherit;
      font-style: inherit;
      letter-spacing: inherit;
      line-height: inherit;
    }

    .word {
      display: inline-block;
      white-space: nowrap;
      will-change: transform, opacity, filter;
      font-size: inherit;
      font-weight: inherit;
      font-family: inherit;
      font-style: inherit;
      letter-spacing: inherit;
      line-height: inherit;
    }
  `

  private wordList: string[] = []
  private colorList: string[] = []
  private timer: ReturnType<typeof setInterval> | null = null
  private busy = false

  connectedCallback() {
    super.connectedCallback()
    this.wordList = this.words
      .split(',')
      .map((w) => w.trim())
      .filter(Boolean)
    this.colorList = this.colors.split(',').map((c) => c.trim())
    this.index = 0
    if (this.wordList.length > 1) {
      this.timer = setInterval(() => this.cycle(), this.interval)
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    if (this.timer) clearInterval(this.timer)
  }

  private cycle() {
    if (this.busy) return
    const wordEl = this.shadowRoot?.querySelector<HTMLElement>('.word')
    if (!wordEl) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const nextIndex = (this.index + 1) % this.wordList.length

    if (reduced) {
      this.index = nextIndex
      return
    }

    this.busy = true

    const fromWidth = this.offsetWidth
    this.style.width = `${fromWidth}px`

    const travel = 16

    animate(
      wordEl,
      { y: -travel, opacity: 0, filter: 'blur(8px)' },
      { type: 'spring', stiffness: 400, damping: 30 },
    ).then(() => {
      this.index = nextIndex
      this.updateComplete.then(() => {
        const el = this.shadowRoot?.querySelector<HTMLElement>('.word')
        if (!el) return

        const toWidth = el.offsetWidth

        animate(
          this,
          { width: [`${fromWidth}px`, `${toWidth}px`] },
          { type: 'spring', stiffness: 300, damping: 32 },
        )

        el.style.transform = `translateY(${travel}px)`
        el.style.opacity = '0'
        el.style.filter = 'blur(8px)'

        animate(
          el,
          { y: [travel, 0], opacity: [0, 1], filter: ['blur(8px)', 'blur(0px)'] },
          { type: 'spring', stiffness: 320, damping: 40 },
        ).then(() => {
          this.busy = false
        })
      })
    })
  }

  render() {
    const word = this.wordList[this.index] ?? ''
    const color = this.colorList[this.index] ?? 'currentColor'
    return html`<span class="word" style="color:${color}">${word}</span>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-words': MotionWords
  }
}
