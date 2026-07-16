import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { animate, stagger } from 'motion'
import { useIntersect } from '../utils/use-intersect.js'
import { Controllable, PlaybackController } from '../../utils/playback.js'
import type { MotionSwapProps, TriggerMode } from './motion-swap.types.js'
import type { AnimationPlaybackControls } from 'motion'

export type { MotionSwapProps, TriggerMode } from './motion-swap.types.js'

interface CharPair {
  container: HTMLElement
  original: HTMLElement
  duplicate: HTMLElement
}

/**
 * Letter-swap text effect. Splits text into individual characters and
 * swaps them vertically on hover or reveal trigger.
 *
 * @element motion-swap
 *
 * @slot - The text to animate. Plain text only — read once on connect.
 *
 * @example
 * ```html
 * <motion-swap>Hello</motion-swap>
 * <motion-swap trigger="reveal">Hello</motion-swap>
 * ```
 */
@customElement('motion-swap')
export class MotionSwap extends Controllable(LitElement) implements MotionSwapProps {
  /** Trigger mode: `'hover'` (swap on mouseenter/mouseleave) or `'reveal'` (one-shot on viewport entry). */
  @property({ type: String }) trigger: TriggerMode = 'hover'

  /** When `true` (default), letters swap bottom-to-top. `false` swaps top-to-bottom. */
  @property({ type: Boolean, reflect: true }) reverse = true

  /** Delay in seconds between each character's animation start. */
  @property({ type: Number, attribute: 'stagger-duration' }) staggerDuration = 0.03

  /** Animation configuration for each character pair. */
  @property({ type: Object, attribute: 'transition' }) transition: Record<string, unknown> = {
    type: 'spring',
    duration: 0.7,
  }

  /** When `true`, only animate the first time the element enters view (reveal mode). */
  @property({ type: Boolean }) once = true

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
  private triggered = false
  private disconnectIntersect: (() => void) | null = null

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  private anims: AnimationPlaybackControls[] = []

  playback: PlaybackController = new PlaybackController(this, {
    start: () => {
      this.stopAnims()
      const originals = this.pairs.map((p) => p.original)
      const duplicates = this.pairs.map((p) => p.duplicate)
      const delayFn = stagger(this.staggerDuration)
      const oAnim = animate(
        originals,
        { y: ['0%', this.reverse ? '-100%' : '100%'], opacity: [1, 0] },
        { delay: delayFn, ...this.transition },
      )
      const dAnim = animate(
        duplicates,
        { y: [this.reverse ? '100%' : '-100%', '0%'], opacity: [0, 1] },
        { delay: delayFn, ...this.transition },
      )
      this.anims = [oAnim, dAnim]
      this.swapped = true
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
    },
    applyFinalState: () => this.setPose(true),
    applyInitialState: () => this.setPose(false),
  })

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
      this.disconnectIntersect = useIntersect(this, 0.1, () => {
        if (this.triggered) return
        this.triggered = true
        if (this.once) this.disconnectIntersect?.()
        const delayMs = this.delay * 1000
        if (delayMs) setTimeout(() => void this.play(), delayMs)
        else void this.play()
      })
    }
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
    this.disconnectIntersect?.()
  }

  private build(text: string) {
    const words = text.split(/\s+/)
    this.pairs = []

    words.forEach((word, wi) => {
      if (wi > 0) {
        this.appendSpace()
      }
      ;[...word].forEach((char) => {
        const pair = this.createCharPair(char)
        this.pairs.push(pair)
        this.appendChild(pair.container)
      })
    })
  }

  private appendSpace() {
    const space = document.createElement('span')
    space.textContent = ' '
    space.style.whiteSpace = 'pre'
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

    const delayFn = stagger(this.staggerDuration)

    this.oAnim = animate(
      originals,
      { y: oTarget, opacity: enter ? 0 : 1 },
      { delay: delayFn, ...this.transition },
    )
    this.dAnim = animate(
      duplicates,
      { y: dTarget, opacity: enter ? 1 : 0 },
      { delay: delayFn, ...this.transition },
    )

    this.swapped = enter
  }

  /** Resets and re-runs the swap animation. */
  replay() {
    this.triggered = false
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
