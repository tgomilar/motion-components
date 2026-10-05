import { LitElement, html, css } from 'lit'
import { property } from 'lit/decorators.js'
import { scroll } from 'motion'
import { Controllable, PlaybackController } from '../../utils/playback.js'
import type { MotionSceneProps } from './motion-scene.types.js'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'

export type { MotionSceneProps } from './motion-scene.types.js'

interface SceneRange {
  start: number
  end: number
  from: Record<string, number | string>
  to: Record<string, number | string>
  keys: string[]
}

/**
 * Scroll-driven scene with sticky positioning and data-driven child animations.
 * Children declare `data-from`/`data-to` JSON and `data-start`/`data-end` progress
 * range to interpolate transform and CSS properties on scroll.
 *
 * **Use it for:** scroll stories where a stage stays pinned while its
 * children move, scale, rotate or fade as the reader scrolls, such as a
 * product reveal.
 *
 * **Avoid it for:** a simple drift on one element; use `motion-parallax`.
 * For a one-time entrance, use `motion-reveal`. Do not put long text in the
 * stage: it is one screen tall and cuts off what does not fit.
 *
 * **Accessibility:** the component adds no roles or aria attributes. Children
 * stay in the page and in reading order, so screen readers can read them at
 * any scroll position, even when `data-from` sets `opacity` to 0. The stage
 * has `overflow: hidden` and is as tall as the viewport or the `container`,
 * so check the scene with large text and on small screens.
 *
 * **Reduced motion:** the scroll animation does not start. Children show
 * their `data-to` end state at once. The scene keeps its `height` and its
 * sticky stage.
 *
 * **Common mistakes:** hiding children in CSS, for example with
 * `opacity: 0`, and showing them only through `data-to`: only the properties
 * listed in `data-from` are animated, so they stay hidden. Put the start
 * values in `data-from` instead. Writing `data-from` or `data-to` as invalid
 * JSON, such as with single quotes: the child is skipped without an error.
 *
 * @element motion-scene
 *
 * @fires motion-start - When a run starts.
 * @fires motion-finish - When a run finishes, or `finish()` jumps to the end.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
 *
 * @cssprop --mc-progress - Set by the scene on itself: scroll progress from `0` to `1`. Read it in your own CSS, for example `calc(var(--mc-progress) * 200)`.
 *
 * @slot - Content rendered inside the sticky viewport-stage. Any child with
 *   `data-from` and `data-to` attributes will be animated on scroll.
 *
 * @example
 * ```html
 * <motion-scene height="300vh">
 *   <div
 *     data-from='{"scale":0.8,"y":"40px"}'
 *     data-to='{"scale":1,"y":"0px"}'
 *     data-start="0"
 *     data-end="0.5"
 *   >Reveal on scroll</div>
 * </motion-scene>
 * ```
 */
@customElement('motion-scene')
export class MotionScene extends Controllable(LitElement) implements MotionSceneProps {
  /** Height of the scroll-driven scene (e.g. `"200vh"`, `"150%"`). */
  @property({ type: String }) height = '200vh'
  /** Whether the inner stage is `position: sticky`. Set `pin="false"` to turn it off. */
  @property({ type: Boolean, converter: flag }) pin = true
  /** CSS selector for a custom scroll container element (defaults to the document). */
  @property({ type: String }) container = ''

  static styles = css`
    :host {
      display: block;
    }

    .inner {
      position: sticky;
      top: 0;
      height: var(--mc-_scene-stage-height, 100vh);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `

  private cleanups: Array<() => void> = []
  private transformMap = new Map<HTMLElement, Record<string, string>>()

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  playback: PlaybackController = new PlaybackController(this, {
    start: () => {
      this.bind()
      return {
        handle: {
          pause: () => this.unbind(),
          resume: () => this.bind(),
          finish: () => {
            this.unbind()
            this.applyProgress(1)
          },
          cancel: () => this.unbind(),
        },
      }
    },
    applyFinalState: () => this.applyProgress(1),
    applyInitialState: () => {
      this.style.removeProperty('--mc-progress')
      for (const el of [...this.querySelectorAll<HTMLElement>('[data-from]')]) {
        const range = this.parseChild(el)
        if (!range) continue
        el.style.transform = ''
        for (const key of range.keys) {
          if (!['x', 'y', 'scale', 'rotate'].includes(key)) el.style.removeProperty(key)
        }
      }
      this.transformMap.clear()
    },
  })

  firstUpdated() {
    this.style.height = this.height
    if (this.reduced) {
      this.applyProgress(1)
      return
    }
    void this.play()
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('height')) {
      this.style.height = this.height
    }
    if (changed.has('pin')) {
      const inner = this.shadowRoot?.querySelector<HTMLElement>('.inner')
      if (inner) {
        inner.style.position = this.pin ? 'sticky' : 'relative'
      }
    }
    if (
      (changed.has('height') || changed.has('container') || changed.has('pin')) &&
      this.playState === 'running'
    ) {
      this.unbind()
      this.bind()
    }
  }

  private unbind() {
    for (const stop of this.cleanups) stop()
    this.cleanups = []
  }

  private resolveContainer(): HTMLElement | undefined {
    if (!this.container) return undefined
    const el = document.querySelector<HTMLElement>(this.container)
    return el ?? undefined
  }

  private bind() {
    const source = this.resolveContainer()

    const stageHeight = source ? `${source.clientHeight}px` : '100vh'
    this.style.setProperty('--mc-_scene-stage-height', stageHeight)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scrollOptions: any = { target: this, offset: ['start start', 'end end'] }
    if (source) scrollOptions.container = source

    const progressCleanup = scroll((progress: number) => {
      this.style.setProperty('--mc-progress', String(progress))
    }, scrollOptions)
    this.cleanups.push(progressCleanup)

    for (const el of [...this.querySelectorAll<HTMLElement>('[data-from]')]) {
      this.bindChild(el, source)
    }
  }

  private bindChild(el: HTMLElement, source?: HTMLElement) {
    const range = this.parseChild(el)
    if (!range) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scrollOptions: any = { target: this, offset: ['start start', 'end end'] }
    if (source) scrollOptions.container = source

    const cleanup = scroll((progress: number) => {
      this.applyChild(el, range, progress)
    }, scrollOptions)

    this.cleanups.push(cleanup)
  }

  private parseChild(el: HTMLElement): SceneRange | null {
    const start = parseFloat(el.dataset.start ?? '0')
    const end = parseFloat(el.dataset.end ?? '1')

    let from: Record<string, number | string>
    let to: Record<string, number | string>

    try {
      from = JSON.parse(el.dataset.from ?? '{}')
      to = JSON.parse(el.dataset.to ?? '{}')
    } catch {
      return null
    }

    const keys = Object.keys(from)
    if (!keys.length) return null

    return { start, end, from, to, keys }
  }

  private applyChild(el: HTMLElement, range: SceneRange, progress: number) {
    const clamped = Math.max(0, Math.min(1, (progress - range.start) / (range.end - range.start)))
    for (const key of range.keys) {
      const val = this.lerp(range.from[key], range.to[key], clamped)
      this.applyProp(el, key, val)
    }
  }

  private applyProgress(progress: number) {
    this.style.setProperty('--mc-progress', String(progress))
    for (const el of [...this.querySelectorAll<HTMLElement>('[data-from]')]) {
      const range = this.parseChild(el)
      if (range) this.applyChild(el, range, progress)
    }
  }

  private lerp(a: number | string, b: number | string, t: number): string {
    if (typeof a === 'number' && typeof b === 'number') {
      return String(a + (b - a) * t)
    }
    const aMatch = String(a).match(/^(-?[\d.]+)(.*)$/)
    const bMatch = String(b).match(/^(-?[\d.]+)(.*)$/)
    if (aMatch && bMatch) {
      const val = parseFloat(aMatch[1]) + (parseFloat(bMatch[1]) - parseFloat(aMatch[1])) * t
      return `${val}${aMatch[2]}`
    }
    return t < 0.5 ? String(a) : String(b)
  }

  private applyProp(el: HTMLElement, prop: string, val: string) {
    const isTransformProp = ['x', 'y', 'scale', 'rotate'].includes(prop)

    if (isTransformProp) {
      const transforms = this.transformMap.get(el) ?? {}
      transforms[prop] = val
      this.transformMap.set(el, transforms)
      el.style.transform = [
        transforms.x ? `translateX(${transforms.x})` : '',
        transforms.y ? `translateY(${transforms.y})` : '',
        transforms.scale ? `scale(${transforms.scale})` : '',
        transforms.rotate ? `rotate(${transforms.rotate})` : '',
      ]
        .filter(Boolean)
        .join(' ')
    } else {
      el.style.setProperty(prop, val)
    }
  }

  render() {
    return html`
      <div class="inner">
        <slot></slot>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-scene': MotionScene
  }
}
