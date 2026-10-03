import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion, stubIntersectionObserver, waitForEvent } from '../../test/helpers.js'
import type { IntersectionHandle } from '../../test/helpers.js'

// The reveal runs through Motion's spring; the contract is the keyframes,
// stagger and spring options handed to `animate`, so both are mocked.
const { animateMock, staggerMock, controls } = vi.hoisted(() => {
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
  const staggerMock = vi.fn((interval: number, opts?: object) => ({ stagger: interval, ...opts }))
  return { animateMock, staggerMock, controls }
})
vi.mock('motion', () => ({ animate: animateMock, stagger: staggerMock }))

import type { MotionHeadline } from './motion-headline.js'
import './motion-headline.js'

const units = (el: MotionHeadline, variant = 'slide') =>
  variant === 'flip'
    ? [...el.querySelectorAll<HTMLElement>('span')]
    : [...el.querySelectorAll<HTMLElement>('span > span')]

describe('motion-headline', () => {
  let io: IntersectionHandle

  beforeEach(() => {
    stubReducedMotion(false)
    io = stubIntersectionObserver()
    animateMock.mockClear()
    staggerMock.mockClear()
    controls.length = 0
  })

  async function mount(tpl = html`<motion-headline>Motion first web</motion-headline>`) {
    const el = (await fixture(tpl)) as MotionHeadline
    await elementUpdated(el)
    return el
  }

  it('has the documented defaults', async () => {
    const el = await mount()
    expect(el.by).toBe('words')
    expect(el.variant).toBe('slide')
    expect(el.getAttribute('variant')).toBe('slide')
    expect(el.interval).toBe(0.06)
    expect(el.duration).toBe(1)
    expect(el.delay).toBe(0)
    expect(el.threshold).toBe(0.2)
    expect(el.once).toBe(true)
  })

  it('slide variant wraps each word in an aria-hidden mask and labels the host', async () => {
    const el = await mount()
    expect(el.getAttribute('aria-label')).toBe('Motion first web')
    const masks = [...el.children] as HTMLElement[]
    expect(masks).toHaveLength(3)
    for (const m of masks) {
      expect(m.getAttribute('aria-hidden')).toBe('true')
      expect(m.style.overflow).toBe('hidden')
    }
    expect(units(el).map((u) => u.textContent)).toEqual(['Motion', 'first', 'web'])
    expect(units(el).every((u) => u.style.transform === 'translateY(110%)')).toBe(true)
    expect(el.hasAttribute('data-ready')).toBe(true)
  })

  it('by="chars" masks every character', async () => {
    const el = await mount(html`<motion-headline by="chars">Hi yo</motion-headline>`)
    expect(units(el).map((u) => u.textContent)).toEqual(['H', 'i', 'y', 'o'])
    expect(el.getAttribute('aria-label')).toBe('Hi yo')
  })

  it('flip variant renders aria-hidden units rotated away and labels the host', async () => {
    const el = await mount(html`<motion-headline variant="flip">Flip it now</motion-headline>`)
    expect(el.getAttribute('aria-label')).toBe('Flip it now')
    expect(el.style.perspective).toBe('600px')
    const u = units(el, 'flip')
    expect(u.map((s) => s.textContent)).toEqual(['Flip', 'it', 'now'])
    for (const s of u) {
      expect(s.getAttribute('aria-hidden')).toBe('true')
      expect(s.style.opacity).toBe('0')
      expect(s.style.transform).toBe('perspective(400px) rotateX(90deg)')
    }
  })

  it('flip variant with by="chars" splits characters and falls back to words for lines', async () => {
    const chars = await mount(
      html`<motion-headline variant="flip" by="chars">ab cd</motion-headline>`,
    )
    expect(units(chars, 'flip').map((s) => s.textContent)).toEqual(['a', 'b', 'c', 'd'])
    const lines = await mount(
      html`<motion-headline variant="flip" by="lines">ab cd</motion-headline>`,
    )
    expect(units(lines, 'flip').map((s) => s.textContent)).toEqual(['ab', 'cd'])
  })

  it('observes the host and waits for the viewport', async () => {
    const el = await mount()
    expect(io.observed).toEqual([el])
    expect(el.playState).toBe('idle')
    expect(animateMock).not.toHaveBeenCalled()
  })

  it('marks empty content ready without observing', async () => {
    const el = await mount(html`<motion-headline></motion-headline>`)
    expect(el.hasAttribute('data-ready')).toBe(true)
    expect(io.observed).toHaveLength(0)
  })

  it('slide variant animates units up from under the mask with a staggered spring', async () => {
    const el = await mount(
      html`<motion-headline interval="0.1" duration="0.7" delay="0.3">One two</motion-headline>`,
    )
    io.enter()
    expect(el.playState).toBe('running')
    expect(animateMock).toHaveBeenCalledOnce()
    const [targets, keyframes, options] = animateMock.mock.calls[0]
    expect(targets).toEqual(units(el))
    expect(keyframes).toEqual({ y: ['110%', '0%'] })
    expect(staggerMock).toHaveBeenCalledWith(0.1, { startDelay: 0.3 })
    expect(options).toEqual({
      delay: { stagger: 0.1, startDelay: 0.3 },
      duration: 0.7,
      type: 'spring',
      bounce: 0.05,
    })
  })

  it('flip variant animates rotateX and opacity with a staggered spring', async () => {
    const el = await mount(html`<motion-headline variant="flip">One two</motion-headline>`)
    io.enter()
    const [targets, keyframes, options] = animateMock.mock.calls[0]
    expect(targets).toEqual(units(el, 'flip'))
    expect(keyframes).toEqual({ rotateX: [90, 0], opacity: [0, 1] })
    expect(staggerMock).toHaveBeenCalledWith(0.06, { startDelay: 0 })
    expect(options).toMatchObject({ duration: 1, type: 'spring', bounce: 0.1 })
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
    const el = await mount(html`<motion-headline once="false">One two</motion-headline>`)
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

  it('cancel() restores the masked state for slide', async () => {
    const el = await mount()
    io.enter()
    el.cancel()
    expect(controls[0].cancel).toHaveBeenCalled()
    expect(el.playState).toBe('idle')
    expect(units(el).every((u) => u.style.transform === 'translateY(110%)')).toBe(true)
  })

  it('cancel() restores the rotated state for flip', async () => {
    const el = await mount(html`<motion-headline variant="flip">One two</motion-headline>`)
    io.enter()
    el.cancel()
    for (const u of units(el, 'flip')) {
      expect(u.style.transform).toBe('perspective(400px) rotateX(90deg)')
      expect(u.style.opacity).toBe('0')
    }
  })

  it('replay() resets and runs again', async () => {
    const el = await mount()
    io.enter()
    el.finish()
    el.replay()
    expect(el.playState).toBe('running')
    expect(animateMock).toHaveBeenCalledTimes(2)
  })

  it('under reduced motion, shows the final state without animating', async () => {
    stubReducedMotion(true)
    const el = await mount(html`<motion-headline variant="flip">One two</motion-headline>`)
    io.enter()
    expect(animateMock).not.toHaveBeenCalled()
    expect(el.playState).toBe('finished')
    for (const u of units(el, 'flip')) {
      expect(u.style.transform).toBe('')
      expect(u.style.opacity).toBe('1')
    }
  })

  it('stops observing when disconnected', async () => {
    const el = await mount()
    el.remove()
    expect(io.observed).toHaveLength(0)
  })
})
