import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fixture, html } from '@open-wc/testing-helpers'
import { stubReducedMotion, stubIntersectionObserver, waitForEvent } from '../../test/helpers.js'
import type { IntersectionHandle } from '../../test/helpers.js'
import type * as Motion from 'motion'

// The reveal runs through Motion's spring; the contract is the targets,
// keyframes and stagger options handed to `animate`, so we mock it and keep
// the real `stagger` to check the computed delays.
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
vi.mock('motion', async (importOriginal) => ({
  ...(await importOriginal<typeof Motion>()),
  animate: animateMock,
}))

import type { MotionStagger } from './motion-stagger.js'
import './motion-stagger.js'

type Delay = (index: number, total: number) => number
const settle = () => new Promise((resolve) => setTimeout(resolve))
const items = (el: MotionStagger) => Array.from(el.children) as HTMLElement[]
const revealCall = () =>
  animateMock.mock.calls.find((call) => {
    const keyframes = call[1] as { opacity: unknown }
    return Array.isArray(keyframes.opacity)
  })!

describe('motion-stagger', () => {
  let io: IntersectionHandle

  beforeEach(() => {
    stubReducedMotion(false)
    io = stubIntersectionObserver()
    animateMock.mockClear()
    runs.length = 0
  })

  async function mount(from = 'first', once = 'true') {
    const el = (await fixture(
      html`<motion-stagger interval="0.1" duration="0.4" y="20" from=${from} once=${once}>
        <div>One</div>
        <div>Two</div>
        <div>Three</div>
      </motion-stagger>`,
    )) as MotionStagger
    await settle()
    return el
  }

  it('renders a slot and exposes prop defaults', async () => {
    const el = (await fixture(
      html`<motion-stagger><div>One</div></motion-stagger>`,
    )) as MotionStagger
    expect(el.shadowRoot!.querySelector('slot')).not.toBeNull()
    expect(el.interval).toBe(0.06)
    expect(el.duration).toBe(0.5)
    expect(el.y).toBe(16)
    expect(el.from).toBe('first')
    expect(el.once).toBe(true)
    expect(getComputedStyle(el).display).toBe('contents')
  })

  it('hides children up front and observes the first child', async () => {
    const el = await mount()
    for (const item of items(el)) expect(item.style.opacity).toBe('0')
    expect(animateMock).toHaveBeenCalledOnce()
    const [targets, keyframes, options] = animateMock.mock.calls[0]
    expect(targets).toEqual(items(el))
    expect(keyframes).toEqual({ opacity: 0, y: 20 })
    expect(options).toEqual({ duration: 0 })
    expect(io.observed).toEqual([items(el)[0]])
    expect(el.playState).toBe('idle')
  })

  it('reveals all children in sequence with a spring on enter', async () => {
    const el = await mount()
    io.enter()
    expect(el.playState).toBe('running')
    const [targets, keyframes, options] = revealCall()
    expect(targets).toEqual(items(el))
    expect(keyframes).toEqual({ opacity: [0, 1], y: [20, 0] })
    expect(options).toMatchObject({ type: 'spring', bounce: 0.2, duration: 0.4 })
    const delay = (options as { delay: Delay }).delay
    expect(delay(0, 3)).toBeCloseTo(0)
    expect(delay(2, 3)).toBeCloseTo(0.2)
  })

  it('from="last" staggers from the end of the list', async () => {
    await mount('last')
    io.enter()
    const delay = (revealCall()[2] as { delay: Delay }).delay
    expect(delay(0, 3)).toBeCloseTo(0.2)
    expect(delay(2, 3)).toBeCloseTo(0)
  })

  it('from="center" staggers outward from the middle', async () => {
    await mount('center')
    io.enter()
    const delay = (revealCall()[2] as { delay: Delay }).delay
    expect(delay(1, 3)).toBeCloseTo(0)
    expect(delay(0, 3)).toBeCloseTo(0.1)
    expect(delay(2, 3)).toBeCloseTo(0.1)
  })

  it('settles to finished when the animation completes', async () => {
    const el = await mount()
    io.enter()
    const finished = waitForEvent(el, 'motion-finish')
    runs[runs.length - 1].resolve()
    await finished
    expect(el.playState).toBe('finished')
  })

  it('with `once`, disconnects the observer after the first reveal', async () => {
    await mount()
    io.enter()
    expect(io.observed).toHaveLength(0)
  })

  it('once="false" keeps observing after the reveal', async () => {
    const el = await mount('first', 'false')
    expect(el.once).toBe(false)
    io.enter()
    expect(io.observed).toEqual([items(el)[0]])
  })

  it('pause() and play() forward to the Motion controls', async () => {
    const el = await mount()
    io.enter()
    const run = runs[runs.length - 1]
    el.pause()
    expect(el.playState).toBe('paused')
    expect(run.pause).toHaveBeenCalled()
    void el.play()
    expect(el.playState).toBe('running')
    expect(run.play).toHaveBeenCalled()
  })

  it('finish() before reveal shows every child', async () => {
    const el = await mount()
    el.finish()
    expect(el.playState).toBe('finished')
    for (const item of items(el)) {
      expect(item.style.opacity).toBe('1')
      expect(item.style.transform).toBe('')
    }
  })

  it('finish() completes a running animation', async () => {
    const el = await mount()
    io.enter()
    el.finish()
    expect(runs[runs.length - 1].complete).toHaveBeenCalled()
    expect(el.playState).toBe('finished')
  })

  it('cancel() stops the animation and hides every child', async () => {
    const el = await mount()
    io.enter()
    const cancelled = waitForEvent(el, 'motion-cancel')
    el.cancel()
    await cancelled
    expect(runs[runs.length - 1].cancel).toHaveBeenCalled()
    expect(el.playState).toBe('idle')
    for (const item of items(el)) expect(item.style.opacity).toBe('0')
  })

  it('replay() resets and runs again', async () => {
    const el = await mount()
    io.enter()
    el.finish()
    animateMock.mockClear()
    el.replay()
    expect(el.playState).toBe('running')
    expect(animateMock).toHaveBeenCalledOnce()
    expect(animateMock.mock.calls[0][1]).toEqual({ opacity: [0, 1], y: [20, 0] })
  })

  it('under reduced motion, leaves children visible and never observes', async () => {
    stubReducedMotion(true)
    const el = await mount()
    for (const item of items(el)) expect(item.style.opacity).toBe('')
    expect(animateMock).not.toHaveBeenCalled()
    expect(io.observed).toHaveLength(0)

    void el.play()
    expect(animateMock).not.toHaveBeenCalled()
    expect(el.playState).toBe('finished')
    for (const item of items(el)) expect(item.style.opacity).toBe('1')
  })
})
