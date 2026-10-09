import { LitElement } from 'lit'
import { property } from 'lit/decorators.js'
import { animate } from 'motion'
import {
  Controllable,
  PlaybackController,
  controlsHandle,
  controlsRun,
} from '../../utils/playback.js'
import type { PlaybackHandle, PlaybackRun } from '../../utils/playback.js'
import { flag } from '../../utils/attributes.js'
import { LoopCycle, LoopTrigger, pauseOnHover } from './loop.js'
import type { LoopProps } from './loop.js'
import type { MarkProps, MarkTrigger } from './mark.types.js'

export type { MarkProps, MarkTrigger } from './mark.types.js'

const PROGRESS = '--mc-_mark-progress'
const TAIL = '--mc-_mark-tail'

/**
 * Shared base for marks that draw onto their text: the subclass paints the
 * mark between the CSS custom properties `--mc-_mark-tail` and
 * `--mc-_mark-progress`. This class springs the progress from 0 to 1 on the
 * chosen trigger. With `loop`, it then springs the tail from 0 to 1, so the
 * mark leaves at its end, and starts again.
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
  private hoverGoal: number | null = null
  private sweepNext = false
  private keep = false
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
    start: () => {
      if (this.sweepNext) {
        this.sweepNext = false
        return this.sweepRun()
      }
      if (this.hoverGoal !== null) return this.hoverRun(this.hoverGoal)
      return this.loop ? { handle: this.cycle.start() } : this.startDraw()
    },
    applyFinalState: () => {
      this.cycle.stop()
      this.setTail(0)
      this.setProgress(this.hoverGoal === 0 ? 0 : 1)
    },
    applyInitialState: () => {
      if (this.keep) return
      this.cycle.stop()
      this.setTail(0)
      this.setProgress(0)
    },
  })

  private cycle: LoopCycle = new LoopCycle({
    leg: (out: boolean) =>
      out
        ? this.erase()
        : controlsRun(animate(this, { [PROGRESS]: [this.progress, 1] }, this.spring)),
    hold: () => this.hold,
    gap: () => this.gap,
    delay: () => this.delay,
  })

  /**
   * Erases the mark from its start, so it leaves at its end, then resets it for
   * the next draw. A finish or cancel skips the reset, so the state they apply stays.
   */
  private erase(): PlaybackRun {
    const controls = animate(this, { [TAIL]: [this.tail, 1] }, { ...this.spring, bounce: 0 })
    let live = true
    return {
      handle: {
        ...controlsHandle(controls),
        finish: () => {
          live = false
          controls.complete()
        },
        cancel: () => {
          live = false
          if (this.keep) controls.stop()
          else controls.cancel()
        },
      },
      done: {
        then: (resolve: () => void) =>
          controls.then(() => {
            if (live) {
              this.setTail(0)
              this.setProgress(0)
            }
            resolve()
          }),
      },
    }
  }

  /** Springs the head to `goal` from wherever it is, drawing back any part a sweep has erased. */
  private hoverRun(goal: number): PlaybackRun {
    const controls = animate(
      this,
      { [PROGRESS]: [this.progress, goal], [TAIL]: [this.tail, 0] },
      this.spring,
    )
    return {
      handle: {
        ...controlsHandle(controls),
        cancel: () => (this.keep ? controls.stop() : controls.cancel()),
        finish: () => {
          controls.stop()
          this.setTail(0)
          this.setProgress(goal)
        },
      },
      done: controls,
    }
  }

  /** One sweep as a playback run: erase from the start, then draw in again. */
  private sweepRun(): PlaybackRun {
    const erase = this.erase()
    let phase: PlaybackHandle = erase.handle
    let ended = false
    let settle: () => void = () => {}
    const done = new Promise<void>((resolve) => (settle = resolve))
    erase.done?.then(() => {
      if (ended) return
      const draw = animate(this, { [PROGRESS]: [0, 1] }, this.spring)
      phase = {
        ...controlsHandle(draw),
        cancel: () => (this.keep ? draw.stop() : draw.cancel()),
      }
      void draw.then(() => settle())
    })
    return {
      handle: {
        pause: () => phase.pause(),
        resume: () => phase.resume(),
        finish: () => {
          ended = true
          phase.cancel()
          this.setTail(0)
          this.setProgress(1)
        },
        cancel: () => {
          ended = true
          phase.cancel()
        },
      },
      done,
    }
  }

  private startDraw(): PlaybackRun {
    return controlsRun(
      animate(this, { [PROGRESS]: [this.progress, 1] }, { ...this.spring, delay: this.delay }),
    )
  }

  connectedCallback() {
    super.connectedCallback()
    this.setTail(0)
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
    this.hoverGoal = null
    this.cancel()
    void this.play()
  }

  /**
   * Sweeps a drawn mark across: it erases from its start, so it leaves at its
   * end, then draws in again from the start. Calls while a sweep runs, before
   * the mark is drawn, or under reduced motion do nothing.
   */
  sweep() {
    if (this.reduced || this.playState !== 'finished' || this.progress < 1) return
    this.sweepNext = true
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
    this.hoverGoal = null
    this.viewport.disarm()
    this.hoverTarget.removeEventListener('pointerenter', this.onEnter)
    this.hoverTarget.removeEventListener('pointerleave', this.onLeave)
    this.detachPauseOnHover?.()
    this.detachPauseOnHover = null
  }

  private onEnter = () => this.drawTo(1)

  private onLeave = () => this.drawTo(0)

  /** Draws towards `goal` from wherever the mark is, as a playback run, so an interrupted run keeps its place. */
  private drawTo(goal: number) {
    this.hoverGoal = goal
    if (this.playState === 'running' || this.playState === 'paused') {
      this.keep = true
      this.cancel()
      this.keep = false
    }
    void this.play()
  }

  private get progress() {
    return Number(this.style.getPropertyValue(PROGRESS)) || 0
  }

  private setProgress(progress: number) {
    this.style.setProperty(PROGRESS, String(progress))
  }

  private get tail() {
    return Number(this.style.getPropertyValue(TAIL)) || 0
  }

  private setTail(tail: number) {
    this.style.setProperty(TAIL, String(tail))
  }
}
