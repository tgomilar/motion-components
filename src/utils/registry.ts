import type { MotionControllable } from './playback.types.js'

type ControllableHost = HTMLElement & MotionControllable
type DisableableHost = HTMLElement & { disabled: boolean }

const controllables = new Set<ControllableHost>()
const disableables = new Set<DisableableHost>()
const autoDisabled = new WeakSet<DisableableHost>()

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
}

/** Cancel every motion-* instance inside `root`, resetting to initial state. */
export function cancelAll(root: Node = document): void {
  for (const el of controllables) {
    if (root.contains(el)) el.cancel()
  }
}
