import { LitElement, html, css } from 'lit'
import { property, state } from 'lit/decorators.js'
import { animate } from 'motion'
import type { AnimationPlaybackControls } from 'motion'
import { Controllable, PlaybackController } from '../../utils/playback.js'
import type { MotionWordsProps } from './motion-words.types.js'
import { customElement } from '../../utils/define.js'

export type { MotionWordsProps } from './motion-words.types.js'

/** Splits a comma-separated list, keeping commas inside parentheses, so `rgb(1, 2, 3)` stays whole. */
const splitList = (value: string) =>
  value
    .split(/,(?![^(]*\))/)
    .map((item) => item.trim())
    .filter(Boolean)

/**
 * Rotating word swap. Cycles through a comma-separated list of `words`,
 * springing the host width between values and crossfading each word with
 * a translate + blur transition. Optional per-word `colors` list.
 *
 * **Use it for:** one word inside a heading or sentence that should change
 * on a timer, such as a verb that takes turns with other verbs.
 *
 * **Avoid it for:** information people must read in full, because only one
 * word shows at a time, and long phrases, which do not wrap. To type a
 * phrase out letter by letter, use `motion-typewriter`.
 *
 * **Accessibility:** only the current word is in the page, and changes are
 * not announced (there is no live region), so a screen reader reads the word
 * that shows at that moment. Make sure the sentence makes sense with every
 * word. The words change without end, and the component gives users no way
 * to stop them. Check that every color in `colors` has enough contrast with
 * the background.
 *
 * **Reduced motion:** the words still change every `interval` seconds, but
 * each change is instant, with no slide, blur or width animation. `pause()`,
 * `play()` and `cancel()` control the cycle as usual.
 *
 * **Common mistakes:** putting the words as child text: the component only
 * reads the `words` attribute and does not show its children. A `words` list
 * with fewer than two entries never changes.
 *
 * @element motion-words
 *
 * @fires motion-start - When a run starts.
 * @fires motion-finish - When a run finishes, or `finish()` jumps to the end.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
 *
 * @example
 * ```html
 * <motion-words
 *   words="ship, design, animate"
 *   colors="#2563eb, #db2777, #16a34a"
 *   interval="2">
 * </motion-words>
 * ```
 */
@customElement('motion-words')
export class MotionWords extends Controllable(LitElement) implements MotionWordsProps {
  /** Comma-separated list of words to cycle through. */
  @property({ type: String }) words = ''
  /** Comma-separated list of CSS colors, one per word. Optional. */
  @property({ type: String }) colors = ''
  /** Time each word stays visible, in seconds. */
  @property({ type: Number }) interval = 2

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
      this.schedule(this.interval * 1000)
      return {
        handle: {
          pause: () => {
            this.holdTimer()
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
    runsUnderReducedMotion: true,
  })

  connectedCallback() {
    super.connectedCallback()
    this.parseLists()
    this.start()
  }

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has('words') || changed.has('colors')) this.parseLists()
  }

  updated(changed: Map<string, unknown>) {
    if (changed.get('words') === undefined) return
    this.stopTimer()
    this.cancel()
    this.start()
  }

  private parseLists() {
    this.wordList = splitList(this.words)
    this.colorList = splitList(this.colors)
  }

  private start() {
    this.index = 0
    if (this.wordList.length < 2) return
    void this.play()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.stopTimer()
  }

  private schedule(ms: number) {
    this.nextFireAt = performance.now() + ms
    this.timer = setTimeout(() => {
      this.cycle()
      this.schedule(this.interval * 1000)
    }, ms)
  }

  private stopTimer() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private holdTimer() {
    this.remaining = Math.max(0, this.nextFireAt - performance.now())
    this.stopTimer()
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
    const color = this.colorList[this.index] || 'currentColor'
    return html`<span class="word" style="color:${color}">${word}</span>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-words': MotionWords
  }
}
