export type PlaybackState = 'idle' | 'running' | 'paused' | 'finished'

/** Public playback surface implemented by every controllable component. */
export interface MotionControllable {
  /** Start if idle/finished, resume if paused, no-op if running. */
  play(): Promise<void>
  /** Freeze in place; resumable via `play()`. */
  pause(): void
  /** Jump to the end state immediately. */
  finish(): void
  /** Hard terminate and reset to the initial state. */
  cancel(): void
  readonly playState: PlaybackState
  /** Fresh per run; resolves on finish or cancel, never rejects. */
  readonly finished: Promise<void>
}

/** Per-run adapter over one backing mechanism (Motion controls, rAF, timer, scroll, SMIL). */
export interface PlaybackHandle {
  pause(): void
  resume(): void
  finish(): void
  cancel(): void
}

/** Minimal thenable — matches both Promise and Motion One's controls. */
export interface PlaybackDone {
  then(onResolve: () => void): unknown
}

export interface PlaybackRun {
  handle: PlaybackHandle
  /** Resolves on natural completion. Omit for infinite loops. */
  done?: PlaybackDone
}

/** What a component provides to its PlaybackController. */
export interface PlaybackDelegate {
  /** Begin a run from the initial state. */
  start(): PlaybackRun
  /** Apply the final/rest state without animating. */
  applyFinalState(): void
  /** Restore the pre-animation state. */
  applyInitialState(): void
}
