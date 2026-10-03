import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion, stubIntersectionObserver, waitForEvent } from '../../test/helpers.js'
import type { IntersectionHandle } from '../../test/helpers.js'

// The slide-up runs through Motion's spring; the contract is the keyframes
// and options handed to `animate`, so it is mocked.
const { animateMock, controls } = vi.hoisted(() => {
  const controls: {
    pause: () => void
    play: () => void
    complete: () => void
    cancel: () => void
    resolve: () => void
  }[] = []
  const animateMock = vi.fn((..._args: unknown[]) => {
    let resolve!: () => void
    const done = new Promise<void>((r) => (resolve = r))
    const c = {
      pause: vi.fn(),
      play: vi.fn(),
      complete: vi.fn(() => resolve()),
      cancel: vi.fn(),
      resolve: () => resolve(),
      then: (ok: () => void, fail?: (e: unknown) => void) => done.then(ok, fail),
    }
    controls.push(c)
    return c
  })
  return { animateMock, controls }
})
vi.mock('motion', () => ({ animate: animateMock }))

import type { MotionTextMask } from './motion-text-mask.js'
import './motion-text-mask.js'

const inner = (el: MotionTextMask) => el.shadowRoot!.querySelector<HTMLElement>('.inner')!

describe('motion-text-mask', () => {
  let io: IntersectionHandle

  beforeEach(() => {
    stubReducedMotion(false)
    io = stubIntersectionObserver()
    animateMock.mockClear()
    controls.length = 0
  })

  async function mount(tpl = html`<motion-text-mask>Masked headline</motion-text-mask>`) {
    const el = (await fixture(tpl)) as MotionTextMask
    await elementUpdated(el)
    return el
  }

  it('has the documented defaults', async () => {
    const el = await mount()
    expect(el.duration).toBe(0.9)
    expect(el.delay).toBe(0)
    expect(el.threshold).toBe(0.2)
    expect(el.once).toBe(true)
  })

  it('keeps the slotted text in the light DOM inside an overflow mask', async () => {
    const el = await mount()
    expect(el.textContent).toBe('Masked headline')
    expect(inner(el).querySelector('slot')).not.toBeNull()
    expect(getComputedStyle(el).overflow).toBe('hidden')
  })

  it('starts pushed below the mask and observes the host', async () => {
    const el = await mount()
    expect(inner(el).style.transform).toBe('translateY(110%)')
    expect(io.observed).toEqual([el])
    expect(el.playState).toBe('idle')
    expect(animateMock).not.toHaveBeenCalled()
  })

  it('slides the inner wrapper up with a spring on entering view', async () => {
    const el = await mount(
      html`<motion-text-mask duration="1.1" delay="0.2">Masked</motion-text-mask>`,
    )
    io.enter()
    expect(el.playState).toBe('running')
    expect(animateMock).toHaveBeenCalledOnce()
    const [target, keyframes, options] = animateMock.mock.calls[0]
    expect(target).toBe(inner(el))
    expect(keyframes).toEqual({ y: ['110%', '0%'] })
    expect(options).toEqual({ duration: 1.1, delay: 0.2, type: 'spring', bounce: 0.05 })
  })

  it('settles to finished when the animation completes', async () => {
    const el = await mount()
    io.enter()
    const finish = waitForEvent(el, 'motion-finish')
    controls[0].resolve()
    await finish
    expect(el.playState).toBe('finished')
  })

  it('with `once`, stops observing after the first reveal', async () => {
    const el = await mount()
    expect(io.observed).toEqual([el])
    io.enter()
    expect(io.observed).toHaveLength(0)
  })

  it('once="false" keeps observing after the first reveal', async () => {
    const el = await mount(html`<motion-text-mask once="false">Masked</motion-text-mask>`)
    expect(el.once).toBe(false)
    io.enter()
    expect(io.observed).toEqual([el])
  })

  it('pause() and play() forward to the Motion controls', async () => {
    const el = await mount()
    io.enter()
    el.pause()
    expect(el.playState).toBe('paused')
    expect(controls[0].pause).toHaveBeenCalled()
    void el.play()
    expect(el.playState).toBe('running')
    expect(controls[0].play).toHaveBeenCalled()
  })

  it('finish() completes the animation', async () => {
    const el = await mount()
    io.enter()
    el.finish()
    expect(controls[0].complete).toHaveBeenCalled()
    expect(el.playState).toBe('finished')
  })

  it('cancel() pushes the content back under the mask', async () => {
    const el = await mount()
    io.enter()
    inner(el).style.transform = ''
    el.cancel()
    expect(controls[0].cancel).toHaveBeenCalled()
    expect(el.playState).toBe('idle')
    expect(inner(el).style.transform).toBe('translateY(110%)')
  })

  it('replay() resets and runs again', async () => {
    const el = await mount()
    io.enter()
    el.finish()
    el.replay()
    expect(el.playState).toBe('running')
    expect(animateMock).toHaveBeenCalledTimes(2)
  })

  it('under reduced motion, shows the content in place without animating', async () => {
    stubReducedMotion(true)
    const el = await mount()
    expect(inner(el).style.transform).toBe('')
    io.enter()
    expect(animateMock).not.toHaveBeenCalled()
    expect(el.playState).toBe('finished')
    expect(inner(el).style.transform).toBe('')
  })

  it('stops observing when disconnected', async () => {
    const el = await mount()
    el.remove()
    expect(io.observed).toHaveLength(0)
  })
})
