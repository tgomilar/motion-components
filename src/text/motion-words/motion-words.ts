import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { animate } from 'motion'
import type { AnimationPlaybackControls } from 'motion'
import { Controllable, PlaybackController } from '../../utils/playback.js'
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
export class MotionWords extends Controllable(LitElement) implements MotionWordsProps {
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

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  private wordList: string[] = []
  private colorList: string[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private busy = false
  private nextFireAt = 0
  private remaining = 0
  private cycleToken = 0
  private active: AnimationPlaybackControls[] = []

  playback: PlaybackController = new PlaybackController(this, {
    start: () => {
      this.schedule(this.interval)
      return {
        handle: {
          pause: () => {
            this.remaining = Math.max(0, this.nextFireAt - performance.now())
            this.stopTimer()
            for (const controls of this.active) controls.pause()
          },
          resume: () => {
            for (const controls of this.active) controls.play()
            this.schedule(this.remaining)
          },
          finish: () => this.settle('complete'),
          cancel: () => this.settle('cancel'),
        },
      }
    },
    applyFinalState: () => this.applyRest(),
    applyInitialState: () => {
      this.index = 0
      this.applyRest()
    },
  })

  connectedCallback() {
    super.connectedCallback()
    this.wordList = this.words
      .split(',')
      .map((w) => w.trim())
      .filter(Boolean)
    this.colorList = this.colors.split(',').map((c) => c.trim())
    this.index = 0
    if (this.wordList.length > 1) {
      if (this.reduced) this.schedule(this.interval)
      else void this.play()
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.stopTimer()
  }

  private schedule(ms: number) {
    this.nextFireAt = performance.now() + ms
    this.timer = setTimeout(() => {
      this.cycle()
      this.schedule(this.interval)
    }, ms)
  }

  private stopTimer() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private settle(method: 'complete' | 'cancel') {
    this.cycleToken++
    this.stopTimer()
    for (const controls of this.active) controls[method]()
    this.active = []
    if (method === 'complete') this.applyRest()
    else this.busy = false
  }

  private applyRest() {
    this.busy = false
    this.style.width = ''
    const wordEl = this.shadowRoot?.querySelector<HTMLElement>('.word')
    if (wordEl) {
      wordEl.style.transform = ''
      wordEl.style.opacity = ''
      wordEl.style.filter = ''
    }
  }

  private cycle() {
    if (this.busy) return
    const wordEl = this.shadowRoot?.querySelector<HTMLElement>('.word')
    if (!wordEl) return

    const nextIndex = (this.index + 1) % this.wordList.length

    if (this.reduced) {
      this.index = nextIndex
      return
    }

    this.busy = true
    const token = this.cycleToken

    const fromWidth = this.offsetWidth
    this.style.width = `${fromWidth}px`

    const travel = 16

    const out = animate(
      wordEl,
      { y: -travel, opacity: 0, filter: 'blur(8px)' },
      { type: 'spring', stiffness: 400, damping: 30 },
    )
    this.active = [out]

    out.then(() => {
      if (token !== this.cycleToken) return
      this.index = nextIndex
      this.updateComplete.then(() => {
        if (token !== this.cycleToken) return
        const el = this.shadowRoot?.querySelector<HTMLElement>('.word')
        if (!el) return

        const toWidth = el.offsetWidth

        const width = animate(
          this,
          { width: [`${fromWidth}px`, `${toWidth}px`] },
          { type: 'spring', stiffness: 300, damping: 32 },
        )

        el.style.transform = `translateY(${travel}px)`
        el.style.opacity = '0'
        el.style.filter = 'blur(8px)'

        const enter = animate(
          el,
          { y: [travel, 0], opacity: [0, 1], filter: ['blur(8px)', 'blur(0px)'] },
          { type: 'spring', stiffness: 320, damping: 40 },
        )
        this.active = [width, enter]
        if (this.playState === 'paused') {
          width.pause()
          enter.pause()
        }

        enter.then(() => {
          if (token !== this.cycleToken) return
          this.active = []
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
