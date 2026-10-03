import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fixture, html } from '@open-wc/testing-helpers'
import { stubReducedMotion, stubIntersectionObserver, waitForEvent } from '../../test/helpers.js'
import type { IntersectionHandle } from '../../test/helpers.js'

// The reveal runs through Motion's spring; the contract is the keyframes and
// options handed to `animate`, so we mock it with controllable playback.
const { animateMock, runs } = vi.hoisted(() => {
  const runs: {
    pause: ReturnType<typeof vi.fn>
    play: ReturnType<typeof vi.fn>
    complete: ReturnType<typeof vi.fn>
    cancel: ReturnType<typeof vi.fn>
    resolve: () => void
  }[] = []
  return {
    runs,
    animateMock: vi.fn((..._args: unknown[]) => {
      let resolve!: () => void
      const done = new Promise<void>((r) => (resolve = r))
      const run = {
        pause: vi.fn(),
        play: vi.fn(),
        complete: vi.fn(),
        cancel: vi.fn(),
        resolve,
        then: (ok: () => void, fail?: () => void) => done.then(ok, fail),
      }
      runs.push(run)
      return run
    }),
  }
})
vi.mock('motion', () => ({ animate: animateMock }))

import type { MotionBlurIn } from './motion-blur-in.js'
import './motion-blur-in.js'

describe('motion-blur-in', () => {
  let io: IntersectionHandle

  beforeEach(() => {
    stubReducedMotion(false)
    io = stubIntersectionObserver()
    animateMock.mockClear()
    runs.length = 0
  })

  async function mount(once = 'true') {
    return (await fixture(
      html`<motion-blur-in intensity="12" y="8" duration="0.5" once=${once}>
        <h1>Headline</h1>
      </motion-blur-in>`,
    )) as MotionBlurIn
  }

  it('renders a slot and exposes prop defaults', async () => {
    const el = (await fixture(
      html`<motion-blur-in><p>content</p></motion-blur-in>`,
    )) as MotionBlurIn
    expect(el.shadowRoot!.querySelector('slot')).not.toBeNull()
    expect(el.duration).toBe(0.7)
    expect(el.intensity).toBe(10)
    expect(el.y).toBe(12)
    expect(el.threshold).toBe(0.1)
    expect(el.once).toBe(true)
  })

  it('starts hidden and blurred, and observes the viewport', async () => {
    const el = await mount()
    expect(el.style.opacity).toBe('0')
    expect(el.style.filter).toBe('blur(12px)')
    expect(io.observed).toContain(el)
    expect(el.playState).toBe('idle')
    expect(animateMock).not.toHaveBeenCalled()
  })

  it('passes the threshold to the IntersectionObserver', async () => {
    const Fake = window.IntersectionObserver
    const thresholds: unknown[] = []
    window.IntersectionObserver = class extends Fake {
      constructor(cb: IntersectionObserverCallback, init?: IntersectionObserverInit) {
        super(cb, init)
        thresholds.push(init?.threshold)
      }
    }
    await fixture(html`<motion-blur-in threshold="0.6"><p>content</p></motion-blur-in>`)
    expect(thresholds).toEqual([0.6])
  })

  it('animates opacity, blur and y with a spring on enter', async () => {
    const el = await mount()
    io.enter()
    expect(el.playState).toBe('running')
    expect(animateMock).toHaveBeenCalledOnce()
    const [target, keyframes, options] = animateMock.mock.calls[0]
    expect(target).toBe(el)
    expect(keyframes).toEqual({
      opacity: [0, 1],
      filter: ['blur(12px)', 'blur(0px)'],
      y: [8, 0],
    })
    expect(options).toEqual({ duration: 0.5, type: 'spring', bounce: 0.1 })
  })

  it('settles to finished when the animation completes', async () => {
    const el = await mount()
    io.enter()
    const finished = waitForEvent(el, 'motion-finish')
    runs[0].resolve()
    await finished
    expect(el.playState).toBe('finished')
  })

  it('with `once`, disconnects the observer after the first reveal', async () => {
    const el = await mount()
    io.enter()
    expect(io.observed).not.toContain(el)
    io.enter()
    expect(animateMock).toHaveBeenCalledOnce()
  })

  it('once="false" keeps observing after the reveal', async () => {
    const el = await mount('false')
    expect(el.once).toBe(false)
    io.enter()
    expect(io.observed).toContain(el)
  })

  it('ignores enter while a run is in progress', async () => {
    const el = await mount('false')
    io.enter()
    io.enter()
    expect(animateMock).toHaveBeenCalledOnce()
    expect(el.playState).toBe('running')
  })

  it('pause() and play() forward to the Motion controls', async () => {
    const el = await mount()
    io.enter()
    el.pause()
    expect(el.playState).toBe('paused')
    expect(runs[0].pause).toHaveBeenCalled()
    void el.play()
    expect(el.playState).toBe('running')
    expect(runs[0].play).toHaveBeenCalled()
  })

  it('finish() completes the animation', async () => {
    const el = await mount()
    io.enter()
    el.finish()
    expect(runs[0].complete).toHaveBeenCalled()
    expect(el.playState).toBe('finished')
  })

  it('finish() before reveal applies the focused final state', async () => {
    const el = await mount()
    el.finish()
    expect(el.style.opacity).toBe('1')
    expect(el.style.filter).toBe('')
    expect(el.style.transform).toBe('')
  })

  it('cancel() stops the animation and resets to the blurred initial state', async () => {
    const el = await mount()
    io.enter()
    const cancelled = waitForEvent(el, 'motion-cancel')
    el.cancel()
    await cancelled
    expect(runs[0].cancel).toHaveBeenCalled()
    expect(el.playState).toBe('idle')
    expect(el.style.opacity).toBe('0')
    expect(el.style.filter).toBe('blur(12px)')
  })

  it('replay() resets and runs again', async () => {
    const el = await mount()
    io.enter()
    el.finish()
    el.replay()
    expect(el.playState).toBe('running')
    expect(animateMock).toHaveBeenCalledTimes(2)
  })

  it('under reduced motion, stays unblurred and jumps to the final state', async () => {
    stubReducedMotion(true)
    const el = await mount()
    expect(el.style.opacity).toBe('')
    expect(el.style.filter).toBe('')
    io.enter()
    expect(animateMock).not.toHaveBeenCalled()
    expect(el.playState).toBe('finished')
    expect(el.style.opacity).toBe('1')
  })
})
