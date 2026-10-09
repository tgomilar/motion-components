import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  registerPlayback,
  unregisterPlayback,
  registerDisableable,
  unregisterDisableable,
  pauseAll,
  resumeAll,
  cancelAll,
  registerLoop,
  unregisterLoop,
  isLoopPaused,
} from './registry.js'
import type { MotionControllable, PlaybackState } from './playback.types.js'

/** A minimal controllable element whose playState is directly settable. */
function makeControllable(state: PlaybackState) {
  const el = document.createElement('div') as unknown as HTMLElement & MotionControllable
  let playState = state
  Object.defineProperty(el, 'playState', { get: () => playState })
  el.play = vi.fn(async () => {
    playState = 'running'
  })
  el.pause = vi.fn(() => {
    playState = 'paused'
  })
  el.finish = vi.fn()
  el.cancel = vi.fn(() => {
    playState = 'idle'
  })
  Object.defineProperty(el, 'finished', { get: () => Promise.resolve() })
  document.body.appendChild(el)
  return el
}

function makeDisableable(disabled: boolean) {
  const el = document.createElement('div') as unknown as HTMLElement & { disabled: boolean }
  el.disabled = disabled
  document.body.appendChild(el)
  return el
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('registry — playback control', () => {
  it('pauseAll only pauses running instances inside root', () => {
    const running = makeControllable('running')
    const idle = makeControllable('idle')
    registerPlayback(running)
    registerPlayback(idle)

    pauseAll()
    expect(running.pause).toHaveBeenCalledOnce()
    expect(idle.pause).not.toHaveBeenCalled()

    unregisterPlayback(running)
    unregisterPlayback(idle)
  })

  it('resumeAll only resumes paused instances', () => {
    const paused = makeControllable('paused')
    const finished = makeControllable('finished')
    registerPlayback(paused)
    registerPlayback(finished)

    resumeAll()
    expect(paused.play).toHaveBeenCalledOnce()
    expect(finished.play).not.toHaveBeenCalled()

    unregisterPlayback(paused)
    unregisterPlayback(finished)
  })

  it('cancelAll cancels every registered instance in root', () => {
    const a = makeControllable('running')
    const b = makeControllable('paused')
    registerPlayback(a)
    registerPlayback(b)

    cancelAll()
    expect(a.cancel).toHaveBeenCalledOnce()
    expect(b.cancel).toHaveBeenCalledOnce()

    unregisterPlayback(a)
    unregisterPlayback(b)
  })

  it('scopes to the given root — instances outside are untouched', () => {
    const inside = makeControllable('running')
    const outside = makeControllable('running')
    const root = document.createElement('section')
    root.appendChild(inside)
    document.body.appendChild(root)
    registerPlayback(inside)
    registerPlayback(outside)

    pauseAll(root)
    expect(inside.pause).toHaveBeenCalledOnce()
    expect(outside.pause).not.toHaveBeenCalled()

    unregisterPlayback(inside)
    unregisterPlayback(outside)
  })
})

describe('registry — disableable control', () => {
  it('pauseAll disables enabled components; resumeAll re-enables only those it disabled', () => {
    const auto = makeDisableable(false)
    const userDisabled = makeDisableable(true)
    registerDisableable(auto)
    registerDisableable(userDisabled)

    pauseAll()
    expect(auto.disabled).toBe(true)
    expect(userDisabled.disabled).toBe(true)

    resumeAll()
    // auto is restored; the user's pre-disabled element stays disabled
    expect(auto.disabled).toBe(false)
    expect(userDisabled.disabled).toBe(true)

    unregisterDisableable(auto)
    unregisterDisableable(userDisabled)
  })

  it('unregister stops tracking an element', () => {
    const el = makeDisableable(false)
    registerDisableable(el)
    unregisterDisableable(el)

    pauseAll()
    expect(el.disabled).toBe(false)
  })
})

describe('registry — loops', () => {
  it('pauseAll holds a loop and resumeAll plays it again', () => {
    const el = document.body.appendChild(document.createElement('div'))
    const controls = { pause: vi.fn(), play: vi.fn() }
    registerLoop(el, () => controls)

    pauseAll()
    expect(controls.pause).toHaveBeenCalledOnce()
    expect(isLoopPaused(el)).toBe(true)
    resumeAll()
    expect(controls.play).toHaveBeenCalledOnce()
    expect(isLoopPaused(el)).toBe(false)
    unregisterLoop(el)
  })

  it('a loop removed while held does not stay held after it comes back', () => {
    const el = document.body.appendChild(document.createElement('div'))
    registerLoop(el, () => ({ pause: vi.fn(), play: vi.fn() }))

    pauseAll()
    unregisterLoop(el)
    resumeAll()
    registerLoop(el, () => ({ pause: vi.fn(), play: vi.fn() }))
    expect(isLoopPaused(el)).toBe(false)
    unregisterLoop(el)
  })
})
