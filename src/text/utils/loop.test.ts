import { describe, it, expect, vi, afterEach } from 'vitest'
import { LoopCycle, delayedRun, pauseOnHover } from './loop.js'
import type { PlaybackRun, PlaybackState } from '../../utils/playback.js'

afterEach(() => {
  vi.useRealTimers()
})

/** A leg that records which half ran and finishes on the next microtask. */
const leg = (calls: string[], out: boolean): PlaybackRun => ({
  handle: {
    pause: vi.fn(),
    resume: vi.fn(),
    cancel: vi.fn(),
    finish: vi.fn(),
  },
  done: Promise.resolve().then(() => calls.push(out ? 'out' : 'in')),
})

describe('LoopCycle', () => {
  it('runs the in leg, holds, then runs the out leg', async () => {
    vi.useFakeTimers()
    const calls: string[] = []
    const cycle = new LoopCycle({ hold: () => 1, leg: (out) => leg(calls, out) })

    cycle.start()
    expect(cycle.active).toBe(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toEqual(['in'])

    await vi.advanceTimersByTimeAsync(999)
    expect(calls).toEqual(['in'])
    await vi.advanceTimersByTimeAsync(1)
    expect(calls).toEqual(['in', 'out'])
    expect(cycle.active).toBe(true)
  })

  it('applies the initial delay before the first leg', async () => {
    vi.useFakeTimers()
    const calls: string[] = []
    const cycle = new LoopCycle({ delay: () => 0.5, leg: (out) => leg(calls, out) })

    cycle.start()
    expect(calls).toEqual([])

    await vi.advanceTimersByTimeAsync(499)
    expect(calls).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(calls).toEqual(['in'])
  })

  it('pause() freezes the hold and resume() continues it', async () => {
    vi.useFakeTimers()
    const calls: string[] = []
    const cycle = new LoopCycle({ hold: () => 1, leg: (out) => leg(calls, out) })

    const run = cycle.start()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(400)
    run.pause()
    expect(cycle.paused).toBe(true)

    await vi.advanceTimersByTimeAsync(5000)
    expect(calls).toEqual(['in'])

    run.resume()
    expect(cycle.paused).toBe(false)
    await vi.advanceTimersByTimeAsync(599)
    expect(calls).toEqual(['in'])
    await vi.advanceTimersByTimeAsync(1)
    expect(calls).toEqual(['in', 'out'])
  })

  it('pause() before the first leg freezes the delay', async () => {
    vi.useFakeTimers()
    const calls: string[] = []
    const cycle = new LoopCycle({ delay: () => 1, leg: (out) => leg(calls, out) })

    const run = cycle.start()
    await vi.advanceTimersByTimeAsync(400)
    run.pause()

    await vi.advanceTimersByTimeAsync(5000)
    expect(calls).toEqual([])

    run.resume()
    await vi.advanceTimersByTimeAsync(599)
    expect(calls).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(calls).toEqual(['in'])
  })

  it('pause() freezes an in-flight leg and resume() hands it back', async () => {
    vi.useFakeTimers()
    let resolveDone!: () => void
    const pending: PlaybackRun = {
      handle: {
        pause: vi.fn(),
        resume: vi.fn(),
        cancel: vi.fn(),
        finish: vi.fn(),
      },
      done: new Promise<void>((resolve) => (resolveDone = resolve)),
    }
    const cycle = new LoopCycle({ hold: () => 1, leg: () => pending })

    const run = cycle.start()
    await vi.advanceTimersByTimeAsync(0)
    run.pause()
    expect(pending.handle.pause).toHaveBeenCalled()

    run.resume()
    expect(pending.handle.resume).toHaveBeenCalled()
    resolveDone()
    await vi.advanceTimersByTimeAsync(1000)
    expect(cycle.active).toBe(true)
  })

  it('stops a pending leg timer and stays idle', async () => {
    vi.useFakeTimers()
    const calls: string[] = []
    const cycle = new LoopCycle({ delay: () => 1, leg: (out) => leg(calls, out) })

    cycle.start()
    cycle.stop()
    expect(cycle.active).toBe(false)
    expect(cycle.paused).toBe(false)

    await vi.advanceTimersByTimeAsync(5000)
    expect(calls).toEqual([])
  })

  it('start() restarts a running cycle from the beginning', async () => {
    vi.useFakeTimers()
    const calls: string[] = []
    const cycle = new LoopCycle({ hold: () => 1, leg: (out) => leg(calls, out) })

    cycle.start()
    cycle.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toEqual(['in'])
  })

  it('finish() cancels the cycle', async () => {
    vi.useFakeTimers()
    const calls: string[] = []
    const cycle = new LoopCycle({ hold: () => 4, leg: (out) => leg(calls, out) })

    const run = cycle.start()
    await vi.advanceTimersByTimeAsync(0)
    run.finish()
    expect(cycle.active).toBe(false)

    await vi.advanceTimersByTimeAsync(5000)
    expect(calls).toEqual(['in'])
  })

  it('runs the next cycle after the gap', async () => {
    vi.useFakeTimers()
    const calls: string[] = []
    const cycle = new LoopCycle({ hold: () => 0.2, gap: () => 0.5, leg: (out) => leg(calls, out) })

    cycle.start()
    await vi.advanceTimersByTimeAsync(200)
    expect(calls).toEqual(['in', 'out'])

    await vi.advanceTimersByTimeAsync(499)
    expect(calls).toEqual(['in', 'out'])
    await vi.advanceTimersByTimeAsync(1)
    expect(calls).toEqual(['in', 'out', 'in'])
  })
})

describe('delayedRun', () => {
  it('waits `delay` before starting the run', async () => {
    vi.useFakeTimers()
    const calls: string[] = []
    delayedRun(
      () => 0.5,
      () => leg(calls, false),
    )

    expect(calls).toEqual([])
    await vi.advanceTimersByTimeAsync(499)
    expect(calls).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(calls).toEqual(['in'])
  })

  it('cancel() during the wait never starts the run', async () => {
    vi.useFakeTimers()
    const calls: string[] = []
    const run = delayedRun(
      () => 0.5,
      () => leg(calls, false),
    )

    run.handle.cancel()
    await vi.advanceTimersByTimeAsync(5000)
    expect(calls).toEqual([])
  })

  it('pause() freezes the wait and resume() finishes it', async () => {
    vi.useFakeTimers()
    const calls: string[] = []
    const run = delayedRun(
      () => 0.5,
      () => leg(calls, false),
    )

    await vi.advanceTimersByTimeAsync(200)
    run.handle.pause()
    await vi.advanceTimersByTimeAsync(5000)
    expect(calls).toEqual([])

    run.handle.resume()
    await vi.advanceTimersByTimeAsync(300)
    expect(calls).toEqual(['in'])
  })

  it('resolves done once the run settles', async () => {
    vi.useFakeTimers()
    let resolveDone!: () => void
    const inner: PlaybackRun = {
      handle: { pause: vi.fn(), resume: vi.fn(), cancel: vi.fn(), finish: vi.fn() },
      done: new Promise<void>((resolve) => (resolveDone = resolve)),
    }
    const run = delayedRun(
      () => 0.1,
      () => inner,
    )
    const settled = vi.fn()
    run.done!.then(settled)

    await vi.advanceTimersByTimeAsync(100)
    expect(settled).not.toHaveBeenCalled()

    resolveDone()
    await vi.advanceTimersByTimeAsync(0)
    expect(settled).toHaveBeenCalled()
  })
})

describe('pauseOnHover', () => {
  const host = (state: PlaybackState) => {
    const el = document.createElement('div') as HTMLDivElement & { playState: PlaybackState }
    el.playState = state
    return el
  }

  it('pauses a running loop when the pointer moves over it, not on enter alone', () => {
    const el = host('running')
    const pause = vi.fn(() => (el.playState = 'paused'))
    pauseOnHover(el, () => true, pause, vi.fn())

    el.dispatchEvent(new Event('pointerenter'))
    expect(pause).not.toHaveBeenCalled()

    el.dispatchEvent(new Event('pointermove'))
    el.dispatchEvent(new Event('pointermove'))
    expect(pause).toHaveBeenCalledTimes(1)
  })

  it('resumes on leave only what it paused', () => {
    const el = host('running')
    const resume = vi.fn(() => (el.playState = 'running'))
    pauseOnHover(
      el,
      () => true,
      () => (el.playState = 'paused'),
      resume,
    )

    el.dispatchEvent(new Event('pointerleave'))
    expect(resume).not.toHaveBeenCalled()

    el.dispatchEvent(new Event('pointermove'))
    el.dispatchEvent(new Event('pointerleave'))
    expect(resume).toHaveBeenCalledTimes(1)
  })

  it('never pauses or starts an idle loop', () => {
    const el = host('idle')
    const pause = vi.fn()
    const resume = vi.fn()
    pauseOnHover(el, () => true, pause, resume)

    el.dispatchEvent(new Event('pointermove'))
    el.dispatchEvent(new Event('pointerleave'))
    expect(pause).not.toHaveBeenCalled()
    expect(resume).not.toHaveBeenCalled()
  })

  it('does not resume a loop that was cancelled while paused', () => {
    const el = host('running')
    const resume = vi.fn()
    pauseOnHover(
      el,
      () => true,
      () => (el.playState = 'paused'),
      resume,
    )

    el.dispatchEvent(new Event('pointermove'))
    el.playState = 'idle'
    el.dispatchEvent(new Event('pointerleave'))
    expect(resume).not.toHaveBeenCalled()
  })

  it('does nothing while disabled', () => {
    const el = host('running')
    const pause = vi.fn()
    pauseOnHover(el, () => false, pause, vi.fn())

    el.dispatchEvent(new Event('pointermove'))
    expect(pause).not.toHaveBeenCalled()
  })
})
