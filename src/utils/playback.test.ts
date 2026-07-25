import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlaybackController, controlsHandle, controlsRun, frameLoop } from './playback.js'
import type { PlaybackDelegate, PlaybackHandle } from './playback.types.js'
import { stubReducedMotion } from '../test/helpers.js'

/** A delegate whose backing run completes only when `complete()` is called. */
function makeDelegate() {
  const handle: PlaybackHandle = {
    pause: vi.fn(),
    resume: vi.fn(),
    finish: vi.fn(),
    cancel: vi.fn(),
  }
  const calls = { start: 0, applyFinalState: 0, applyInitialState: 0 }
  const resolvers: Array<() => void> = []

  const delegate: PlaybackDelegate = {
    start() {
      calls.start++
      const done = new Promise<void>((resolve) => {
        resolvers.push(resolve)
      })
      return { handle, done }
    },
    applyFinalState() {
      calls.applyFinalState++
    },
    applyInitialState() {
      calls.applyInitialState++
    },
  }

  // Resolve a specific run's `done` promise; defaults to the latest run.
  const complete = (index = resolvers.length - 1) => resolvers[index]?.()
  return { delegate, handle, calls, complete }
}

function setup() {
  const host = document.createElement('div')
  const { delegate, handle, calls, complete } = makeDelegate()
  const controller = new PlaybackController(host, delegate)
  const events: string[] = []
  for (const name of ['motion-start', 'motion-finish', 'motion-cancel']) {
    host.addEventListener(name, () => events.push(name))
  }
  return { host, controller, handle, calls, complete, events }
}

describe('PlaybackController', () => {
  beforeEach(() => stubReducedMotion(false))

  it('runs idle → running → finished and resolves `finished` on natural completion', async () => {
    const { controller, calls, complete, events } = setup()
    expect(controller.playState).toBe('idle')

    const finished = controller.play()
    expect(controller.playState).toBe('running')
    expect(calls.start).toBe(1)
    expect(events).toEqual(['motion-start'])

    complete()
    await finished
    expect(controller.playState).toBe('finished')
    expect(events).toEqual(['motion-start', 'motion-finish'])
  })

  it('play() while running is a no-op that returns the same promise', () => {
    const { controller, calls } = setup()
    const first = controller.play()
    const second = controller.play()
    expect(second).toBe(first)
    expect(calls.start).toBe(1)
  })

  it('pause() only acts while running; resume via play()', () => {
    const { controller, handle } = setup()
    controller.pause()
    expect(handle.pause).not.toHaveBeenCalled()

    controller.play()
    controller.pause()
    expect(controller.playState).toBe('paused')
    expect(handle.pause).toHaveBeenCalledOnce()

    controller.play()
    expect(controller.playState).toBe('running')
    expect(handle.resume).toHaveBeenCalledOnce()
  })

  it('finish() from running jumps to the end via the handle', async () => {
    const { controller, handle, calls, events } = setup()
    const finished = controller.play()
    controller.finish()
    await finished
    expect(handle.finish).toHaveBeenCalledOnce()
    expect(calls.applyFinalState).toBe(0)
    expect(controller.playState).toBe('finished')
    expect(events).toContain('motion-finish')
  })

  it('finish() from idle applies the final state directly', async () => {
    const { controller, calls } = setup()
    controller.finish()
    await controller.finished
    expect(calls.start).toBe(0)
    expect(calls.applyFinalState).toBe(1)
    expect(controller.playState).toBe('finished')
  })

  it('finish() when already finished is a no-op', () => {
    const { controller, calls } = setup()
    controller.finish()
    controller.finish()
    expect(calls.applyFinalState).toBe(1)
  })

  it('cancel() restores the initial state and emits motion-cancel', async () => {
    const { controller, handle, calls, events } = setup()
    const finished = controller.play()
    controller.cancel()
    await finished
    expect(handle.cancel).toHaveBeenCalledOnce()
    expect(calls.applyInitialState).toBe(1)
    expect(controller.playState).toBe('idle')
    expect(events).toEqual(['motion-start', 'motion-cancel'])
  })

  it('cancel() from idle is a no-op', () => {
    const { controller, calls } = setup()
    controller.cancel()
    expect(calls.applyInitialState).toBe(0)
    expect(controller.playState).toBe('idle')
  })

  it('invalidates a stale run: a completed old run cannot settle a newer run', async () => {
    const { controller, complete } = setup()
    controller.play() // run 1
    controller.cancel() // bumps runId, back to idle
    controller.play() // run 2, now running
    complete(0) // resolves run 1's (stale) done promise
    await Promise.resolve()
    expect(controller.playState).toBe('running')
  })

  it('takes the reduced-motion fast path without starting the backing animation', async () => {
    stubReducedMotion(true)
    const { controller, calls, events } = setup()
    await controller.play()
    expect(calls.start).toBe(0)
    expect(calls.applyFinalState).toBe(1)
    expect(controller.playState).toBe('finished')
    expect(events).toEqual(['motion-start', 'motion-finish'])
  })

  it('teardown() stops silently — no events, no style reset', async () => {
    const { controller, handle, calls, events } = setup()
    controller.play()
    controller.teardown()
    await controller.finished
    expect(handle.cancel).toHaveBeenCalledOnce()
    expect(calls.applyInitialState).toBe(0)
    expect(controller.playState).toBe('idle')
    expect(events).toEqual(['motion-start'])
  })
})

describe('controlsHandle / controlsRun', () => {
  it('maps WAAPI-style verbs onto Motion controls', () => {
    const controls = {
      play: vi.fn(),
      pause: vi.fn(),
      complete: vi.fn(),
      cancel: vi.fn(),
      then: vi.fn(),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handle = controlsHandle(controls as any)
    handle.pause()
    handle.resume()
    handle.finish()
    handle.cancel()
    expect(controls.pause).toHaveBeenCalledOnce()
    expect(controls.play).toHaveBeenCalledOnce()
    expect(controls.complete).toHaveBeenCalledOnce()
    expect(controls.cancel).toHaveBeenCalledOnce()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const run = controlsRun(controls as any)
    expect(run.done).toBe(controls)
  })
})

describe('frameLoop', () => {
  it('tracks running state and ticks with elapsed ms across frames', async () => {
    const dts: number[] = []
    const loop = frameLoop((dt) => dts.push(dt))
    expect(loop.running).toBe(false)

    loop.start()
    expect(loop.running).toBe(true)
    loop.start() // idempotent
    expect(loop.running).toBe(true)

    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    loop.stop()
    expect(loop.running).toBe(false)
    expect(dts.length).toBeGreaterThan(0)
    expect(dts.every((dt) => Number.isFinite(dt))).toBe(true)
  })

  it('stops ticking after stop()', async () => {
    let ticks = 0
    const loop = frameLoop(() => ticks++)
    loop.start()
    loop.stop()
    const before = ticks
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    expect(ticks).toBe(before)
  })
})
