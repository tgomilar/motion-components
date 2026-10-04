import { LitElement, html, css } from 'lit'
import { property, query } from 'lit/decorators.js'
import { animate, stagger } from 'motion'
import { REVEAL_SPRING } from '../../utils/springs.js'
import { Controllable, PlaybackController, controlsRun } from '../../utils/playback.js'
import type { MotionStaggerProps, StaggerFrom } from './motion-stagger.types.js'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'

export type { MotionStaggerProps, StaggerFrom } from './motion-stagger.types.js'

/**
 * Staggered viewport-triggered reveal for a list of children. Fades and
 * translates each direct child in sequence once the first child enters the viewport.
 *
 * **Use it for:** lists, card grids and icon rows whose items should fade and
 * rise into place one after another when the list scrolls into view.
 *
 * **Avoid it for:** a single block of content; use `motion-reveal` or
 * `motion-blur-in`. Avoid long lists that go far below the screen: the whole
 * sequence starts when the first child comes into view, so items lower down
 * can finish animating before anyone scrolls to them.
 *
 * **Accessibility:** the children stay in the page while they are hidden, so
 * screen readers read them before they animate. Only opacity and transform
 * change, so the layout does not shift.
 *
 * **Reduced motion:** all children show at their final position at once,
 * with no animation. No run starts, so `motion-start` and `motion-finish` do
 * not fire.
 *
 * **Common mistakes:** only direct child elements animate. Wrapping all items
 * in one `<div>` or `<ul>` makes them animate as one block; put the items
 * directly inside `motion-stagger`. Text placed directly inside, outside a
 * child element, is not animated.
 *
 * @element motion-stagger
 *
 * @fires motion-start - When a run starts.
 * @fires motion-finish - When a run finishes, or `finish()` jumps to the end.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
 *
 * @slot - The list of children to reveal in sequence.
 *
 * @example
 * ```html
 * <motion-stagger interval="0.08" from="first">
 *   <div>One</div>
 *   <div>Two</div>
 *   <div>Three</div>
 * </motion-stagger>
 * ```
 */
@customElement('motion-stagger')
export class MotionStagger extends Controllable(LitElement) implements MotionStaggerProps {
  /** Delay between each child's reveal, in seconds. */
  @property({ type: Number }) interval = 0.06
  /** Spring duration of each child's reveal, in seconds. */
  @property({ type: Number }) duration = 0.5
  /** Initial vertical offset in pixels for each child; rises to 0. */
  @property({ type: Number }) y = 16
  /** Stagger origin: `'first'`, `'last'` or `'center'`. */
  @property({ type: String }) from: StaggerFrom = 'first'
  /** When `true`, only animate the first time the list enters view. Set `once="false"` to turn it off. */
  @property({ type: Boolean, converter: flag }) once = true

  @query('slot') private slotEl!: HTMLSlotElement

  static styles = css`
    :host {
      display: contents;
    }
  `

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  private observer: IntersectionObserver | null = null
  private animated = false

  playback: PlaybackController = new PlaybackController(this, {
    start: () =>
      controlsRun(
        animate(
          this.slotEl.assignedElements(),
          { opacity: [0, 1], y: [this.y, 0] },
          {
            delay: stagger(this.interval, { from: this.from }),
            ...REVEAL_SPRING,
            duration: this.duration,
          },
        ),
      ),
    applyFinalState: () => {
      for (const el of this.slotEl.assignedElements() as HTMLElement[]) {
        el.style.opacity = '1'
        el.style.transform = ''
      }
    },
    applyInitialState: () => {
      for (const el of this.slotEl.assignedElements() as HTMLElement[]) {
        el.style.opacity = '0'
        el.style.transform = ''
      }
    },
  })

  connectedCallback() {
    super.connectedCallback()
    if (this.reduced) return // eslint-disable-next-line wc/no-child-traversal-in-connectedcallback
    ;(Array.from(this.children) as HTMLElement[]).forEach((child) => {
      child.style.opacity = '0'
    })
  }

  firstUpdated() {
    this.slotEl.addEventListener('slotchange', this.onSlotChange)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.observer?.disconnect()
  }

  private onSlotChange = () => {
    const elements = this.slotEl.assignedElements() as HTMLElement[]
    if (!elements.length) return

    if (this.reduced) return

    if (this.playState !== 'idle') {
      animate(elements, { opacity: 1, y: 0 }, { duration: 0 })
      return
    }

    animate(elements, { opacity: 0, y: this.y }, { duration: 0 })

    this.observer?.disconnect()
    this.observer = new IntersectionObserver(this.onIntersect, { threshold: 0.1 })
    this.observer.observe(elements[0])
  }

  private onIntersect = (entries: IntersectionObserverEntry[]) => {
    for (const entry of entries) {
      if (entry.isIntersecting && !this.animated && this.playState === 'idle') {
        void this.play()
        if (this.once) {
          this.animated = true
          this.observer?.disconnect()
        }
      } else if (!entry.isIntersecting) {
        if (!this.once && this.playState !== 'idle') this.cancel()
      }
    }
  }

  /** Resets and re-runs the staggered reveal. */
  replay() {
    this.animated = false
    this.cancel()
    void this.play()
  }

  render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-stagger': MotionStagger
  }
}
