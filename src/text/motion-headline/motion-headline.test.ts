import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import {
  stubReducedMotion,
  stubIntersectionObserver,
  waitFor,
  waitForEvent,
} from '../../test/helpers.js'
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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const HIDE_KEYFRAMES = (keys: unknown) => JSON.stringify(keys) === '{"y":["0%","110%"]}'
const LOOPED = html`<motion-headline loop hold="0.1" gap="0.1">One two</motion-headline>`
const units = (el: MotionHeadline) => [...el.querySelectorAll<HTMLElement>('[data-unit]')]
const spoken = (el: MotionHeadline) =>
  [...el.children].filter((c) => !c.hasAttribute('aria-hidden')) as HTMLElement[]

describe('motion-headline', () => {
  let io: IntersectionHandle

  beforeEach(() => {
    stubReducedMotion(false)
    io = stubIntersectionObserver()
    animateMock.mockClear()
    staggerMock.mockClear()
    controls.length = 0
  })

  afterEach(() => {
    for (const el of document.querySelectorAll('motion-headline')) el.remove()
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

  it('slide variant wraps each word in an aria-hidden mask and keeps the full text for screen readers', async () => {
    const el = await mount()
    expect(el.hasAttribute('aria-label')).toBe(false)
    expect(spoken(el).map((s) => s.textContent)).toEqual(['Motion first web'])
    const masks = [...el.querySelectorAll<HTMLElement>(':scope > [aria-hidden]')]
    expect(masks).toHaveLength(3)
    for (const m of masks) expect(m.style.overflow).toBe('hidden')
    expect(units(el).map((u) => u.textContent)).toEqual(['Motion', 'first', 'web'])
    expect(units(el).every((u) => u.style.transform === 'translateY(110%)')).toBe(true)
    expect(el.hasAttribute('data-ready')).toBe(true)
  })

  it('by="chars" masks every character', async () => {
    const el = await mount(html`<motion-headline by="chars">Hi yo</motion-headline>`)
    expect(units(el).map((u) => u.textContent)).toEqual(['H', 'i', 'y', 'o'])
    expect(spoken(el).map((s) => s.textContent)).toEqual(['Hi yo'])
  })

  it('flip variant renders aria-hidden units rotated away and keeps the full text for screen readers', async () => {
    const el = await mount(html`<motion-headline variant="flip">Flip it now</motion-headline>`)
    expect(el.hasAttribute('aria-label')).toBe(false)
    expect(spoken(el).map((s) => s.textContent)).toEqual(['Flip it now'])
    expect(el.style.perspective).toBe('600px')
    const u = units(el)
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
    expect(units(chars).map((s) => s.textContent)).toEqual(['a', 'b', 'c', 'd'])
    const lines = await mount(
      html`<motion-headline variant="flip" by="lines">ab cd</motion-headline>`,
    )
    expect(units(lines).map((s) => s.textContent)).toEqual(['ab', 'cd'])
  })

  for (const variant of ['slide', 'flip']) {
    for (const by of ['chars', 'words', 'lines']) {
      it(`variant="${variant}" by="${by}" keeps the full text in one visually hidden span outside the units`, async () => {
        const el = await mount(
          html`<motion-headline variant=${variant} by=${by}>Motion first web</motion-headline>`,
        )
        const [text, ...rest] = spoken(el)
        expect(rest).toHaveLength(0)
        expect(text.textContent).toBe('Motion first web')
        expect(text.style.position).toBe('absolute')
        expect(text.style.clipPath).toBe('inset(50%)')
        expect(units(el).some((u) => u === text || u.contains(text) || text.contains(u))).toBe(
          false,
        )
        expect(el.hasAttribute('aria-label')).toBe(false)
      })
    }
  }

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
    expect(targets).toEqual(units(el))
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
    for (const u of units(el)) {
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
    for (const u of units(el)) {
      expect(u.style.transform).toBe('')
      expect(u.style.opacity).toBe('1')
    }
  })

  it('stops observing when disconnected', async () => {
    const el = await mount()
    el.remove()
    expect(io.observed).toHaveLength(0)
  })

  it('with loop, reveals then hides on repeat and keeps running', async () => {
    const el = await mount(LOOPED)
    io.enter()
    expect(el.playState).toBe('running')
    await wait(20)

    controls[0].resolve()
    await wait(180)
    expect(animateMock).toHaveBeenCalledTimes(2)
    expect(HIDE_KEYFRAMES(animateMock.mock.calls[1][1])).toBeTruthy()

    controls[1].resolve()
    await wait(180)
    expect(el.playState).toBe('running')
  })

  it('with loop, cancels on leave and restarts on the next entry', async () => {
    const el = await mount(html`<motion-headline loop hold="4">One two</motion-headline>`)
    io.enter()
    expect(el.playState).toBe('running')

    io.leave()
    expect(el.playState).toBe('idle')

    io.enter()
    expect(el.playState).toBe('running')
  })

  it('pauses on hover with pause-on-hover and loop', async () => {
    const el = await mount(
      html`<motion-headline loop hold="0.1" pause-on-hover>One two</motion-headline>`,
    )
    io.enter()
    await waitFor(() => controls.length > 0, 'the first loop leg never started')
    el.dispatchEvent(new Event('pointermove'))
    expect(el.playState).toBe('paused')
    expect(controls[controls.length - 1].pause).toHaveBeenCalled()

    el.dispatchEvent(new Event('pointerleave'))
    expect(el.playState).toBe('running')
  })

  it('never starts the loop under reduced motion', async () => {
    stubReducedMotion(true)
    const el = await mount(LOOPED)
    io.enter()
    expect(animateMock).not.toHaveBeenCalled()
    expect(el.playState).toBe('finished')
  })
})
