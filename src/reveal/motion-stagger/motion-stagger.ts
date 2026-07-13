import { LitElement, html, css } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import { animate, stagger } from 'motion'
import { REVEAL_SPRING } from '../../utils/springs.js'
import { Controllable, PlaybackController, controlsRun } from '../../utils/playback.js'
import type { MotionStaggerProps, StaggerFrom } from './motion-stagger.types.js'

export type { MotionStaggerProps, StaggerFrom } from './motion-stagger.types.js'

/**
 * Staggered viewport-triggered reveal for a list of children. Fades and
 * translates each direct child in sequence once the first child enters the viewport.
 *
 * @element motion-stagger
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
  /** Stagger origin: `'first'`, `'last'`, `'center'`, or a numeric index. */
  @property({ type: String }) from: StaggerFrom = 'first'
  /** When `true`, only animate the first time the list enters view. */
  @property({ type: Boolean }) once = true

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
