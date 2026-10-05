import { LitElement } from 'lit'
import { property } from 'lit/decorators.js'
import { animate } from 'motion'
import type { AnimationPlaybackControls } from 'motion'
import { Controllable, PlaybackController, controlsRun } from '../../utils/playback.js'
import type { PlaybackRun } from '../../utils/playback.js'
import { flag } from '../../utils/attributes.js'
import { LoopCycle, LoopTrigger, pauseOnHover } from './loop.js'
import type { LoopProps } from './loop.js'
import type { MarkProps, MarkTrigger } from './mark.types.js'

export type { MarkProps, MarkTrigger } from './mark.types.js'

const PROGRESS = '--mc-_mark-progress'

/**
 * Shared base for marks that draw onto their text: the subclass paints the
 * mark from the CSS custom property `--mc-_mark-progress`, and this class
 * springs it from 0 to 1 on the chosen trigger, or cycles it when `loop`.
 */
export class MarkElement extends Controllable(LitElement) implements MarkProps, LoopProps {
  /** What draws the mark: `'view'` (scrolled into view), `'hover'` (pointer enter, undraws on leave) or `'mount'`. */
  @property({ type: String, reflect: true }) trigger: MarkTrigger = 'view'
  /** Spring duration of the drawing, in seconds. */
  @property({ type: Number }) duration = 0.6
  /** Seconds to wait before drawing. */
  @property({ type: Number }) delay = 0
  /** Spring bounciness. `0` keeps the stroke from overshooting the text. */
  @property({ type: Number }) bounce = 0
  /** Draw, hold, undraw, draw again on repeat. With `trigger="view"` the cycle runs while the mark is on screen. */
  @property({ type: Boolean, converter: flag }) loop = false
  /** With `loop`, seconds the mark stays drawn before it undraws. */
  @property({ type: Number }) hold = 1.6
  /** With `loop`, seconds the mark stays undrawn before it draws again. */
  @property({ type: Number }) gap = 0.5
  /** Pause the loop while the pointer is over the mark, resuming on leave. */
  @property({ type: Boolean, converter: flag, attribute: 'pause-on-hover' }) pauseOnHover = false
  /** With `trigger="view"`, draw only the first time. Set `once="false"` to undraw on leave and draw again on every entry. Ignored with `loop`. */
  @property({ type: Boolean, converter: flag }) once = true
  /** Share of the element, from 0 to 1, that must be visible before it draws. */
  @property({ type: Number }) threshold = 0.6

  private hoverTarget: HTMLElement = this
  private hoverControls: AnimationPlaybackControls | null = null
  private resizer: ResizeObserver | null = null
  private detachPauseOnHover: (() => void) | null = null

  private viewport = new LoopTrigger(this, {
    threshold: () => this.threshold,
    once: () => this.once,
    loop: () => this.loop,
  })

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  private get spring() {
    return { type: 'spring' as const, duration: this.duration, bounce: this.bounce }
  }

  playback: PlaybackController = new PlaybackController(this, {
    start: () => (this.loop ? { handle: this.cycle.start() } : this.startDraw()),
    applyFinalState: () => {
      this.cycle.stop()
      this.setProgress(1)
    },
    applyInitialState: () => {
      this.cycle.stop()
      this.setProgress(0)
    },
  })

  private cycle: LoopCycle = new LoopCycle({
    leg: (out: boolean) =>
      controlsRun(animate(this, { [PROGRESS]: [this.progress, out ? 0 : 1] }, this.spring)),
    hold: () => this.hold,
    gap: () => this.gap,
    delay: () => this.delay,
  })

  private startDraw(): PlaybackRun {
    return controlsRun(
      animate(this, { [PROGRESS]: [this.progress, 1] }, { ...this.spring, delay: this.delay }),
    )
  }

  connectedCallback() {
    super.connectedCallback()
    this.setProgress(0)
    this.resizer = new ResizeObserver(() => this.layout())
    this.resizer.observe(this)
    if (this.hasUpdated) this.setup()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.teardown()
    this.resizer?.disconnect()
    this.resizer = null
  }

  firstUpdated() {
    this.setup()
  }

  updated(changed: Map<string, unknown>) {
    if (
      (changed.has('trigger') && changed.get('trigger') !== undefined) ||
      (changed.has('loop') && changed.get('loop') !== undefined)
    ) {
      this.viewport.reset()
      this.cancel()
      this.setup()
    }
    this.layout()
  }

  /** Sizes an SVG mark to the text. Runs after each update and on resize; marks drawn as a background leave it empty. */
  protected layout() {}

  /** Draws the mark again from the start. */
  replay() {
    this.viewport.reset()
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
      this.viewport.arm()
    }
    this.detachPauseOnHover = pauseOnHover(
      this,
      () => this.loop && this.pauseOnHover,
      () => this.pause(),
      () => this.play(),
    )
  }

  private teardown() {
    this.viewport.disarm()
    this.hoverTarget.removeEventListener('pointerenter', this.onEnter)
    this.hoverTarget.removeEventListener('pointerleave', this.onLeave)
    this.hoverControls?.stop()
    this.hoverControls = null
    this.detachPauseOnHover?.()
    this.detachPauseOnHover = null
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
