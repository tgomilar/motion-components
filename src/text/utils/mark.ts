import { LitElement } from 'lit'
import { property } from 'lit/decorators.js'
import { animate } from 'motion'
import type { AnimationPlaybackControls } from 'motion'
import { Controllable, PlaybackController, controlsRun } from '../../utils/playback.js'
import { flag } from '../../utils/attributes.js'
import { useIntersect } from './use-intersect.js'
import type { MarkProps, MarkTrigger } from './mark.types.js'

export type { MarkProps, MarkTrigger } from './mark.types.js'

const PROGRESS = '--mc-mark-progress'

/**
 * Shared base for marks that draw onto their text: the subclass paints the
 * mark from the CSS custom property `--mc-mark-progress`, and this class
 * springs it from 0 to 1 on the chosen trigger.
 */
export class MarkElement extends Controllable(LitElement) implements MarkProps {
  /** What draws the mark: `'view'` (scrolled into view), `'hover'` (pointer enter, undraws on leave) or `'mount'`. */
  @property({ type: String, reflect: true }) trigger: MarkTrigger = 'view'
  /** Spring duration of the drawing, in seconds. */
  @property({ type: Number }) duration = 0.6
  /** Seconds to wait before drawing. */
  @property({ type: Number }) delay = 0
  /** Spring bounciness. `0` keeps the stroke from overshooting the text. */
  @property({ type: Number }) bounce = 0
  /** With `trigger="view"`, draw only the first time. Set `once="false"` to undraw on leave and draw again on every entry. */
  @property({ type: Boolean, converter: flag }) once = true
  /** Share of the element, from 0 to 1, that must be visible before it draws. */
  @property({ type: Number }) threshold = 0.6

  private hoverTarget: HTMLElement = this
  private hoverControls: AnimationPlaybackControls | null = null
  private disconnectIntersect: (() => void) | null = null
  private drawn = false

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  private get spring() {
    return { type: 'spring' as const, duration: this.duration, bounce: this.bounce }
  }

  playback: PlaybackController = new PlaybackController(this, {
    start: () =>
      controlsRun(
        animate(this, { [PROGRESS]: [this.progress, 1] }, { ...this.spring, delay: this.delay }),
      ),
    applyFinalState: () => this.setProgress(1),
    applyInitialState: () => this.setProgress(0),
  })

  connectedCallback() {
    super.connectedCallback()
    this.setProgress(0)
    if (this.hasUpdated) this.setup()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.teardown()
  }

  firstUpdated() {
    this.setup()
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('trigger') && changed.get('trigger') !== undefined) {
      this.cancel()
      this.setup()
    }
  }

  /** Draws the mark again from the start. */
  replay() {
    this.drawn = false
    this.cancel()
    void this.play()
  }

  private setup() {
    this.teardown()
    if (this.trigger === 'mount') void this.play()
    else if (this.trigger === 'hover') {
      this.hoverTarget = this.closest<HTMLElement>('a, button, [role="button"]') ?? this
      this.hoverTarget.addEventListener('pointerenter', this.onEnter)
      this.hoverTarget.addEventListener('pointerleave', this.onLeave)
    } else {
      this.disconnectIntersect = useIntersect(
        this,
        this.threshold,
        () => {
          if (this.drawn || this.playState !== 'idle') return
          void this.play()
          if (this.once) {
            this.drawn = true
            this.disconnectIntersect?.()
          }
        },
        () => {
          if (!this.once && this.playState !== 'idle') this.cancel()
        },
      )
    }
  }

  private teardown() {
    this.disconnectIntersect?.()
    this.disconnectIntersect = null
    this.hoverTarget.removeEventListener('pointerenter', this.onEnter)
    this.hoverTarget.removeEventListener('pointerleave', this.onLeave)
    this.hoverControls?.stop()
    this.hoverControls = null
  }

  private onEnter = () => this.drawTo(1)

  private onLeave = () => this.drawTo(0)

  private drawTo(progress: number) {
    this.hoverControls?.stop()
    if (this.reduced) {
      this.setProgress(progress)
      return
    }
    this.hoverControls = animate(this, { [PROGRESS]: [this.progress, progress] }, this.spring)
  }

  private get progress() {
    return Number(this.style.getPropertyValue(PROGRESS)) || 0
  }

  private setProgress(progress: number) {
    this.style.setProperty(PROGRESS, String(progress))
  }
}
