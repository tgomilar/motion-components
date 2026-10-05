import type { PlaybackHandle, PlaybackRun, PlaybackState } from '../../utils/playback.js'
import { useIntersect } from './use-intersect.js'

/** The shared loop surface. Implemented by every component that can repeat. */
export interface LoopProps {
  /** Repeat the run: enter, hold, leave, wait, enter again. */
  loop?: boolean
  /** With `loop`, seconds the component stays in its final state. */
  hold?: number
  /** With `loop`, seconds between cycles, in the initial state. */
  gap?: number
  /** Pause the cycle while the pointer is over the component. */
  pauseOnHover?: boolean
}

export interface LoopCycleOptions {
  /**
   * Builds one half of a cycle. `out` is `false` for the entering leg and
   * `true` for the leaving leg. Return `null` for a leg that applies its state
   * instantly, such as a counter snapping back to `from`.
   */
  leg(out: boolean): PlaybackRun | null
  /** With `loop`, seconds in the final state. Defaults to `0`. Read per cycle so it stays live. */
  hold?(): number
  /** With `loop`, seconds in the initial state. Defaults to `0`. Read per cycle so it stays live. */
  gap?(): number
  /** Seconds before the first leg. Defaults to `0`. */
  delay?(): number
}

/**
 * Runs `leg(false)` → wait `hold` → `leg(true)` → wait `gap` → repeat, with
 * pause and resume that survive both a pending wait and an in-flight leg.
 * Shared by every loopable text component so the cycle, the interruption
 * points and the hold/gap timing behave identically across the library.
 */
export class LoopCycle {
  private readonly options: LoopCycleOptions
  private timer: ReturnType<typeof setTimeout> | null = null
  private pending: (() => void) | null = null
  private dueAt = 0
  private remaining = 0
  private leg: PlaybackHandle | null = null
  private running = false
  private frozen = false

  constructor(options: LoopCycleOptions) {
    this.options = options
  }

  /** True between `start` and `stop`, including while paused. */
  get active(): boolean {
    return this.running
  }

  /** True while a paused cycle is holding its place. */
  get paused(): boolean {
    return this.frozen
  }

  /** Starts the cycle from the initial state and returns the playback handle. */
  start(): PlaybackHandle {
    this.stop()
    this.running = true
    this.remaining = 0
    this.schedule(() => this.runLeg(false), (this.options.delay?.() ?? 0) * 1000)
    return {
      pause: () => this.pause(),
      resume: () => this.resume(),
      finish: () => this.stop(),
      cancel: () => this.stop(),
    }
  }

  /** Clears the pending wait and drops any in-flight leg. */
  stop(): void {
    this.running = false
    this.frozen = false
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.pending = null
    this.leg?.cancel()
    this.leg = null
  }

  private pause(): void {
    this.frozen = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
      this.remaining = Math.max(0, this.dueAt - performance.now())
    } else {
      this.remaining = 0
    }
    this.leg?.pause()
  }

  private resume(): void {
    this.frozen = false
    this.leg?.resume()
    if (this.pending) this.schedule(this.pending, this.remaining)
  }

  private schedule(step: () => void, ms: number): void {
    this.pending = step
    this.dueAt = performance.now() + ms
    this.timer = setTimeout(() => {
      this.timer = null
      this.pending = null
      step()
    }, ms)
  }

  private runLeg(out: boolean): void {
    if (!this.running) return
    const run = this.options.leg(out)
    if (!run) {
      this.wait(out)
      return
    }
    this.leg = run.handle
    run.done?.then(() => {
      if (!this.running) return
      this.leg = null
      this.wait(out)
    })
  }

  private wait(out: boolean): void {
    const wait = out ? (this.options.gap?.() ?? 0) : (this.options.hold?.() ?? 0)
    this.schedule(() => this.runLeg(!out), wait * 1000)
  }
}

/**
 * Holds a one-off run back by `delay` seconds before it starts. Pause, resume
 * and cancel all interrupt the wait, so a delayed run behaves like any other
 * and a view trigger that leaves before the delay elapses never starts.
 */
export function delayedRun(delay: () => number, start: () => PlaybackRun): PlaybackRun {
  let timer: ReturnType<typeof setTimeout> | null = null
  let dueAt = 0
  let remaining = delay() * 1000
  let inner: PlaybackHandle | null = null
  let resolveDone: (() => void) | null = null
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve
  })

  const arm = (ms: number) => {
    remaining = ms
    dueAt = performance.now() + ms
    timer = setTimeout(() => {
      timer = null
      const run = start()
      inner = run.handle
      run.done?.then(() => resolveDone?.())
    }, ms)
  }

  arm(remaining)

  return {
    handle: {
      pause: () => {
        if (timer) {
          clearTimeout(timer)
          timer = null
          remaining = Math.max(0, dueAt - performance.now())
        }
        inner?.pause()
      },
      resume: () => {
        if (!timer && !inner && remaining > 0) arm(remaining)
        inner?.resume()
      },
      finish: () => {
        if (timer) {
          clearTimeout(timer)
          timer = null
        } else {
          inner?.finish()
        }
      },
      cancel: () => {
        if (timer) {
          clearTimeout(timer)
          timer = null
        } else {
          inner?.cancel()
        }
      },
    },
    done,
  }
}

/** What `LoopTrigger` needs from its host: the controllable playback surface. */
export interface LoopTarget extends HTMLElement {
  play(): Promise<void>
  cancel(): void
  readonly playState: PlaybackState
}

export interface LoopTriggerOptions {
  /** Reads live so a changed `threshold` applies on the next arm. */
  threshold(): number
  once(): boolean
  loop(): boolean
  /** Element to observe. Defaults to the host. */
  observe?(): Element
}

/**
 * Arms the viewport wiring shared by every view-triggered component, so
 * `loop`, `once` and leave-cancel behave the same everywhere. A looping run
 * plays while the element is on screen and cancels on leave, then restarts on
 * the next entry; a non-looping run plays once when `once` is set, or on every
 * entry when it is not.
 */
export class LoopTrigger {
  private disconnect: (() => void) | null = null
  private triggered = false

  constructor(
    private host: LoopTarget,
    private options: LoopTriggerOptions,
  ) {}

  /** Observes the host, or `observe`, and starts reacting to intersections. */
  arm(): void {
    this.disarm()
    this.disconnect = useIntersect(
      this.options.observe?.() ?? this.host,
      this.options.threshold(),
      () => {
        if (this.options.loop()) {
          if (this.host.playState === 'idle') void this.host.play()
          return
        }
        if (this.triggered || this.host.playState !== 'idle') return
        void this.host.play()
        if (this.options.once()) {
          this.triggered = true
          this.disconnect?.()
        }
      },
      () => {
        if ((this.options.loop() || !this.options.once()) && this.host.playState !== 'idle') {
          this.host.cancel()
        }
      },
    )
  }

  /** Clears the seen-once flag so the next entry plays again. */
  reset(): void {
    this.triggered = false
  }

  /** Stops observing. */
  disarm(): void {
    this.disconnect?.()
    this.disconnect = null
  }
}

/**
 * Wires `pause-on-hover` for a loop: freezes the cycle on pointer enter and
 * resumes it on leave. `enabled` is read per event, so toggling the attribute
 * after the first render takes effect without re-setup. Returns a detach
 * function for teardown.
 */
export function pauseOnHover(
  host: HTMLElement,
  enabled: () => boolean,
  pause: () => void,
  resume: () => void,
): () => void {
  const onEnter = () => {
    if (enabled()) pause()
  }
  const onLeave = () => {
    if (enabled()) resume()
  }
  host.addEventListener('pointerenter', onEnter)
  host.addEventListener('pointerleave', onLeave)
  return () => {
    host.removeEventListener('pointerenter', onEnter)
    host.removeEventListener('pointerleave', onLeave)
  }
}
