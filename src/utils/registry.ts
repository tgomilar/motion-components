import type { MotionControllable } from './playback.types.js'

type ControllableHost = HTMLElement & MotionControllable
type DisableableHost = HTMLElement & { disabled: boolean }
type LoopControls = { pause(): void; play(): void }

const controllables = new Set<ControllableHost>()
const disableables = new Set<DisableableHost>()
const autoDisabled = new WeakSet<DisableableHost>()
const loops = new Map<HTMLElement, () => LoopControls | null>()
const pausedLoops = new WeakSet<HTMLElement>()

export function registerPlayback(el: ControllableHost): void {
  controllables.add(el)
}

export function unregisterPlayback(el: ControllableHost): void {
  controllables.delete(el)
}

export function registerDisableable(el: DisableableHost): void {
  disableables.add(el)
}

export function unregisterDisableable(el: DisableableHost): void {
  disableables.delete(el)
}

/** Tracks an endless decorative animation, such as a spinner, so `pauseAll` can hold it. */
export function registerLoop(el: HTMLElement, controls: () => LoopControls | null): void {
  loops.set(el, controls)
}

export function unregisterLoop(el: HTMLElement): void {
  loops.delete(el)
  // resumeAll only reaches registered loops, so a hold must not outlive the registration
  pausedLoops.delete(el)
}

/** Whether `pauseAll` is holding this element's loop, so a newly started loop should start paused. */
export function isLoopPaused(el: HTMLElement): boolean {
  return pausedLoops.has(el)
}

/**
 * Pause every running motion-* instance inside `root` and disable
 * input-reactive components. Reversible with `resumeAll`.
 */
export function pauseAll(root: Node = document): void {
  for (const el of controllables) {
    if (root.contains(el) && el.playState === 'running') el.pause()
  }
  for (const el of disableables) {
    if (root.contains(el) && !el.disabled) {
      el.disabled = true
      autoDisabled.add(el)
    }
  }
  for (const [el, controls] of loops) {
    if (!root.contains(el) || pausedLoops.has(el)) continue
    controls()?.pause()
    pausedLoops.add(el)
  }
}

/**
 * Resume paused instances inside `root` and re-enable only the
 * input-reactive components that `pauseAll` disabled.
 */
export function resumeAll(root: Node = document): void {
  for (const el of controllables) {
    if (root.contains(el) && el.playState === 'paused') el.play()
  }
  for (const el of disableables) {
    if (root.contains(el) && autoDisabled.has(el)) {
      el.disabled = false
      autoDisabled.delete(el)
    }
  }
  for (const [el, controls] of loops) {
    if (!root.contains(el) || !pausedLoops.has(el)) continue
    pausedLoops.delete(el)
    controls()?.play()
  }
}

/** Cancel every motion-* instance inside `root`, resetting to initial state. */
export function cancelAll(root: Node = document): void {
  for (const el of controllables) {
    if (root.contains(el)) el.cancel()
  }
}
