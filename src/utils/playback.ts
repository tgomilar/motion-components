import type { AnimationPlaybackControls } from 'motion'
import type {
  MotionControllable,
  PlaybackDelegate,
  PlaybackHandle,
  PlaybackRun,
  PlaybackState,
} from './playback.types.js'
import { registerPlayback, unregisterPlayback } from './registry.js'

export type {
  MotionControllable,
  PlaybackDelegate,
  PlaybackHandle,
  PlaybackRun,
  PlaybackState,
} from './playback.types.js'

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Normalizes playback over any backing mechanism behind the WAAPI-style
 * verbs. Owns the state machine, the per-run `finished` promise, lifecycle
 * events, and the reduced-motion fast path.
 */
export class PlaybackController implements MotionControllable {
  private state: PlaybackState = 'idle'
  private handle: PlaybackHandle | null = null
  private done: Promise<void> = Promise.resolve()
  private resolveDone: (() => void) | null = null
  private runId = 0

  constructor(
    private host: HTMLElement,
    private delegate: PlaybackDelegate,
  ) {}

  get playState(): PlaybackState {
    return this.state
  }

  get finished(): Promise<void> {
    return this.done
  }

  play(): Promise<void> {
    if (this.state === 'running') return this.done
    if (this.state === 'paused') {
      this.handle?.resume()
      this.state = 'running'
      return this.done
    }
    const id = ++this.runId
    this.done = new Promise((resolve) => {
      this.resolveDone = resolve
    })
    this.emit('motion-start')
    if (reduced()) {
      this.delegate.applyFinalState()
      this.settle('finished', 'motion-finish')
      return this.done
    }
    this.state = 'running'
    const run = this.delegate.start()
    this.handle = run.handle
    run.done?.then(() => {
      if (id === this.runId && this.state === 'running') {
        this.settle('finished', 'motion-finish')
      }
    })
    return this.done
  }

  pause(): void {
    if (this.state !== 'running') return
    this.handle?.pause()
    this.state = 'paused'
  }

  finish(): void {
    if (this.state === 'finished') return
    this.runId++
    if (this.handle) this.handle.finish()
    else this.delegate.applyFinalState()
    this.settle('finished', 'motion-finish')
  }

  cancel(): void {
    if (this.state === 'idle') return
    this.runId++
    this.handle?.cancel()
    this.delegate.applyInitialState()
    this.settle('idle', 'motion-cancel')
  }

  /** Stop silently without events or style resets — for disconnectedCallback. */
  teardown(): void {
    this.runId++
    this.handle?.cancel()
    this.handle = null
    this.resolveDone?.()
    this.resolveDone = null
    this.state = 'idle'
  }

  private settle(state: PlaybackState, event: 'motion-finish' | 'motion-cancel'): void {
    this.handle = null
    this.state = state
    this.resolveDone?.()
    this.resolveDone = null
    this.emit(event)
  }

  private emit(name: string): void {
    this.host.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }))
  }
}

export function controlsHandle(controls: AnimationPlaybackControls): PlaybackHandle {
  return {
    pause: () => controls.pause(),
    resume: () => controls.play(),
    finish: () => controls.complete(),
    cancel: () => controls.cancel(),
  }
}

export function controlsRun(controls: AnimationPlaybackControls): PlaybackRun {
  return { handle: controlsHandle(controls), done: controls }
}

export interface FrameLoop {
  start(): void
  stop(): void
  readonly running: boolean
}

/**
 * Resumable requestAnimationFrame loop. `tick` receives the elapsed
 * milliseconds since the previous frame, so accumulated phase survives
 * a stop/start cycle without jumping.
 */
export function frameLoop(tick: (dt: number) => void): FrameLoop {
  let raf: number | null = null
  let last = 0
  const step = (now: number) => {
    tick(now - last)
    last = now
    raf = requestAnimationFrame(step)
  }
  return {
    start() {
      if (raf !== null) return
      last = performance.now()
      raf = requestAnimationFrame(step)
    },
    stop() {
      if (raf !== null) cancelAnimationFrame(raf)
      raf = null
    },
    get running() {
      return raf !== null
    },
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T = object> = new (...args: any[]) => T

interface CustomElementLifecycle {
  connectedCallback?(): void
  disconnectedCallback?(): void
}

export declare class ControllableInterface implements MotionControllable {
  playback: PlaybackController
  play(): Promise<void>
  pause(): void
  finish(): void
  cancel(): void
  get playState(): PlaybackState
  get finished(): Promise<void>
  connectedCallback(): void
  disconnectedCallback(): void
}

/**
 * Adds the MotionControllable surface to an element class, forwarding to
 * `this.playback` (assigned by the subclass), and keeps the instance
 * registered for pauseAll/resumeAll/cancelAll while connected.
 */
export function Controllable<T extends Constructor<HTMLElement & CustomElementLifecycle>>(
  Base: T,
): T & Constructor<ControllableInterface> {
  class ControllableElement extends Base implements MotionControllable {
    playback!: PlaybackController

    play(): Promise<void> {
      return this.playback.play()
    }

    pause(): void {
      this.playback.pause()
    }

    finish(): void {
      this.playback.finish()
    }

    cancel(): void {
      this.playback.cancel()
    }

    get playState(): PlaybackState {
      return this.playback.playState
    }

    get finished(): Promise<void> {
      return this.playback.finished
    }

    connectedCallback(): void {
      super.connectedCallback?.()
      registerPlayback(this)
    }

    disconnectedCallback(): void {
      super.disconnectedCallback?.()
      unregisterPlayback(this)
      this.playback?.teardown()
    }
  }
  return ControllableElement
}
