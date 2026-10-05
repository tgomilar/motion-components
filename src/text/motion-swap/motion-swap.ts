import { LitElement, html, css } from 'lit'
import { property } from 'lit/decorators.js'
import { animate, stagger } from 'motion'
import { LoopCycle, LoopTrigger, pauseOnHover } from '../utils/loop.js'
import type { LoopProps } from '../utils/loop.js'
import { Controllable, PlaybackController } from '../../utils/playback.js'
import type { PlaybackRun } from '../../utils/playback.js'
import type { MotionSwapProps, TriggerMode } from './motion-swap.types.js'
import type { AnimationPlaybackControls } from 'motion'
import { wordParts } from '../utils/word-parts.js'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'

export type { MotionSwapProps, TriggerMode } from './motion-swap.types.js'

interface CharPair {
  container: HTMLElement
  original: HTMLElement
  duplicate: HTMLElement
}

/**
 * Letter-swap text effect. Splits text into individual characters and
 * swaps them vertically on hover or when scrolled into view.
 *
 * **Use it for:** short labels and headings whose letters should slide out
 * while copies slide in, when the mouse moves over them or when they scroll
 * into view (`trigger="view"`).
 *
 * **Avoid it for:** long text, because every letter becomes two spans, and
 * text with links or other markup, which is removed. To move a whole element
 * on hover, use `motion-hover`.
 *
 * **Accessibility:** screen readers read the whole text once from a visually
 * hidden copy, which also names a link or button the text sits in. The
 * letters, both the visible ones and the copies that swap in, are
 * `aria-hidden`. The hover trigger reacts to the mouse only, not to keyboard
 * focus.
 *
 * **Reduced motion:** the letters never swap. The text stays still in its
 * normal state.
 *
 * **Common mistakes:** changing the text or `trigger` after the first render:
 * both are read once, so replace the element instead. Setting `delay` with
 * the hover trigger and expecting it only on enter: the swap back on mouse
 * leave waits for `delay` too.
 *
 * @element motion-swap
 *
 * @fires motion-start - When a run starts.
 * @fires motion-finish - When a run finishes, or `finish()` jumps to the end.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
 *
 * @slot - The text to animate. Plain text only — read once on connect.
 *
 * @example
 * ```html
 * <motion-swap>Hello</motion-swap>
 * <motion-swap trigger="view">Hello</motion-swap>
 * ```
 */
@customElement('motion-swap')
export class MotionSwap extends Controllable(LitElement) implements MotionSwapProps, LoopProps {
  /** Trigger mode: `'hover'` (swap on mouseenter/mouseleave) or `'view'` (swap on viewport entry). */
  @property({ type: String }) trigger: TriggerMode = 'hover'

  /** Letters swap bottom-to-top. Set `reverse="false"` to swap top-to-bottom. */
  @property({ type: Boolean, converter: flag, reflect: true }) reverse = true

  /** Delay in seconds between each character's animation start. */
  @property({ type: Number }) interval = 0.03

  /** Spring duration of each character swap, in seconds. */
  @property({ type: Number }) duration = 0.7
  /** Spring bounciness (0 = critically damped, higher = more elastic). */
  @property({ type: Number }) bounce = 0.3

  /** When `true`, only animate the first time the element enters view (`trigger="view"`). Set `once="false"` to turn it off. Ignored with `loop`. */
  @property({ type: Boolean, converter: flag }) once = true
  /** Swap the words, hold, swap back, then repeat. With `trigger="view"` the cycle runs while on screen. */
  @property({ type: Boolean, converter: flag }) loop = false
  /** With `loop`, seconds the swapped words stay in place before they swap back. */
  @property({ type: Number }) hold = 1.6
  /** With `loop`, seconds before the next swap. */
  @property({ type: Number }) gap = 0.5
  /** Pause the loop while the pointer is over the text. */
  @property({ type: Boolean, converter: flag, attribute: 'pause-on-hover' }) pauseOnHover = false

  /** Delay in seconds before the animation starts. */
  @property({ type: Number }) delay = 0

  static styles = css`
    :host {
      display: inline;
    }
    :host(:not([data-ready])) {
      visibility: hidden;
    }
  `

  private pairs: CharPair[] = []
  private oAnim: AnimationPlaybackControls | null = null
  private dAnim: AnimationPlaybackControls | null = null
  private swapped = false
  private detachPauseOnHover: (() => void) | null = null

  private viewport = new LoopTrigger(this, {
    threshold: () => 0.1,
    once: () => this.once,
    loop: () => this.loop,
  })

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  private anims: AnimationPlaybackControls[] = []

  playback: PlaybackController = new PlaybackController(this, {
    start: () => (this.loop ? { handle: this.cycle.start() } : this.swap(true, this.delay)),
    applyFinalState: () => {
      this.cycle.stop()
      this.setPose(true)
    },
    applyInitialState: () => {
      this.cycle.stop()
      this.setPose(false)
    },
  })

  private cycle: LoopCycle = new LoopCycle({
    leg: (out) => this.swap(!out),
    hold: () => this.hold,
    gap: () => this.gap,
    delay: () => this.delay,
  })

  private swap(enter: boolean, startDelay = 0): PlaybackRun {
    this.stopAnims()
    const originals = this.pairs.map((p) => p.original)
    const duplicates = this.pairs.map((p) => p.duplicate)
    const delayFn = stagger(this.interval, { startDelay })
    const exited = this.reverse ? '-100%' : '100%'
    const entered = this.reverse ? '100%' : '-100%'
    const oAnim = animate(
      originals,
      enter ? { y: ['0%', exited], opacity: [1, 0] } : { y: [exited, '0%'], opacity: [0, 1] },
      { delay: delayFn, type: 'spring', duration: this.duration, bounce: this.bounce },
    )
    const dAnim = animate(
      duplicates,
      enter ? { y: [entered, '0%'], opacity: [0, 1] } : { y: ['0%', entered], opacity: [1, 0] },
      { delay: delayFn, type: 'spring', duration: this.duration, bounce: this.bounce },
    )
    this.anims = [oAnim, dAnim]
    this.swapped = enter
    return {
      handle: {
        pause: () => {
          for (const a of this.anims) a.pause()
        },
        resume: () => {
          for (const a of this.anims) a.play()
        },
        finish: () => {
          for (const a of this.anims) a.complete()
        },
        cancel: () => {
          for (const a of this.anims) a.cancel()
        },
      },
      done: oAnim,
    }
  }

  private setPose(swapped: boolean) {
    const originals = this.pairs.map((p) => p.original)
    const duplicates = this.pairs.map((p) => p.duplicate)
    const oY = swapped ? (this.reverse ? '-100%' : '100%') : '0%'
    const dY = swapped ? '0%' : this.reverse ? '100%' : '-100%'
    animate(originals, { y: oY, opacity: swapped ? 0 : 1 }, { duration: 0 })
    animate(duplicates, { y: dY, opacity: swapped ? 1 : 0 }, { duration: 0 })
  }

  firstUpdated() {
    const text = this.textContent?.trim()
    if (!text) return

    this.replaceChildren()
    this.build(text)
    this.setPose(false)
    this.setAttribute('data-ready', '')

    if (this.reduced) return

    if (this.trigger === 'hover') {
      this.addEventListener('mouseenter', this.onEnter)
      this.addEventListener('mouseleave', this.onLeave)
    } else {
      this.viewport.arm()
    }

    this.detachPauseOnHover = pauseOnHover(
      this,
      () => this.loop && this.pauseOnHover,
      () => this.pause(),
      () => this.play(),
    )
  }

  private stopAnims() {
    for (const a of this.anims) a.stop()
    this.anims = []
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.stopAnims()
    this.oAnim?.stop()
    this.dAnim?.stop()
    this.removeEventListener('mouseenter', this.onEnter)
    this.removeEventListener('mouseleave', this.onLeave)
    this.viewport.disarm()
    this.detachPauseOnHover?.()
    this.detachPauseOnHover = null
  }

  private build(text: string) {
    const words = text.split(/\s+/)
    this.pairs = []

    const label = document.createElement('span')
    label.textContent = words.join(' ')
    label.style.cssText =
      'position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;'
    this.appendChild(label)

    words.forEach((word, wi) => {
      if (wi > 0) {
        this.appendSpace()
      }
      for (const part of wordParts(word)) {
        const group = document.createElement('span')
        group.style.cssText = 'display: inline-block; white-space: nowrap;'
        group.setAttribute('aria-hidden', 'true')
        ;[...part].forEach((char) => {
          const pair = this.createCharPair(char)
          this.pairs.push(pair)
          group.appendChild(pair.container)
        })
        this.appendChild(group)
      }
    })
  }

  private appendSpace() {
    const space = document.createElement('span')
    space.textContent = ' '
    space.style.whiteSpace = 'pre'
    space.setAttribute('aria-hidden', 'true')
    this.appendChild(space)
  }

  private createCharPair(char: string): CharPair {
    const container = document.createElement('span')
    container.style.cssText =
      'display: inline-block; position: relative; overflow: hidden; vertical-align: bottom;'

    const original = document.createElement('span')
    original.textContent = char
    original.style.cssText =
      'display: inline-block; will-change: transform; transform: translateY(0%);'
    container.appendChild(original)

    const duplicate = document.createElement('span')
    duplicate.textContent = char
    const dupeStart = this.reverse ? '100%' : '-100%'
    duplicate.style.cssText = `display: inline-block; position: absolute; left: 0; top: 0; will-change: transform, opacity; transform: translateY(${dupeStart}); opacity: 0;`
    container.appendChild(duplicate)

    return { container, original, duplicate }
  }

  private onEnter = () => {
    if (this.trigger !== 'hover') return
    if (this.delay) {
      setTimeout(() => this.animateSwap(true), this.delay * 1000)
    } else {
      this.animateSwap(true)
    }
  }

  private onLeave = () => {
    if (this.trigger !== 'hover') return
    if (this.delay) {
      setTimeout(() => this.animateSwap(false), this.delay * 1000)
    } else {
      this.animateSwap(false)
    }
  }

  private animateSwap(enter: boolean) {
    if (this.reduced) return
    this.oAnim?.stop()
    this.dAnim?.stop()

    const originals = this.pairs.map((p) => p.original)
    const duplicates = this.pairs.map((p) => p.duplicate)

    const oTarget = enter ? (this.reverse ? '-100%' : '100%') : '0%'
    const dTarget = enter ? '0%' : this.reverse ? '100%' : '-100%'

    const delayFn = stagger(this.interval)

    this.oAnim = animate(
      originals,
      { y: oTarget, opacity: enter ? 0 : 1 },
      { delay: delayFn, type: 'spring', duration: this.duration, bounce: this.bounce },
    )
    this.dAnim = animate(
      duplicates,
      { y: dTarget, opacity: enter ? 1 : 0 },
      { delay: delayFn, type: 'spring', duration: this.duration, bounce: this.bounce },
    )

    this.swapped = enter
  }

  /** Resets and re-runs the swap animation. */
  replay() {
    this.viewport.reset()
    this.swapped = false
    this.cancel()
    void this.play()
  }

  render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-swap': MotionSwap
  }
}
