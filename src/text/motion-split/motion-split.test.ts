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

import type { MotionSplit } from './motion-split.js'
import './motion-split.js'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const units = (el: MotionSplit) => [...el.querySelectorAll<HTMLElement>('[data-unit]')]
const spoken = (el: MotionSplit) =>
  [...el.children].filter((c) => !c.hasAttribute('aria-hidden')) as HTMLElement[]

describe('motion-split', () => {
  let io: IntersectionHandle

  beforeEach(() => {
    stubReducedMotion(false)
    io = stubIntersectionObserver()
    animateMock.mockClear()
    staggerMock.mockClear()
    controls.length = 0
  })

  afterEach(() => {
    for (const el of document.querySelectorAll('motion-split')) el.remove()
  })

  async function mount(attrs = html`<motion-split>Hello brave new world</motion-split>`) {
    const el = (await fixture(attrs)) as MotionSplit
    await elementUpdated(el)
    return el
  }

  it('has the documented defaults', async () => {
    const el = await mount()
    expect(el.by).toBe('words')
    expect(el.getAttribute('by')).toBe('words')
    expect(el.interval).toBe(0.05)
    expect(el.duration).toBe(0.6)
    expect(el.y).toBe(20)
    expect(el.once).toBe(true)
  })

  it('splits words into aria-hidden spans and keeps the full text for screen readers', async () => {
    const el = await mount()
    expect(el.hasAttribute('aria-label')).toBe(false)
    expect(spoken(el).map((s) => s.textContent)).toEqual(['Hello brave new world'])
    expect(units(el).map((s) => s.textContent)).toEqual(['Hello', 'brave', 'new', 'world'])
    expect(units(el).every((s) => s.getAttribute('aria-hidden') === 'true')).toBe(true)
    expect(el.hasAttribute('data-ready')).toBe(true)
  })

  it('by="chars" splits into one span per character', async () => {
    const el = await mount(html`<motion-split by="chars">Hi yo</motion-split>`)
    expect(units(el).map((s) => s.textContent)).toEqual(['H', 'i', 'y', 'o'])
    expect(spoken(el).map((s) => s.textContent)).toEqual(['Hi yo'])
  })

  it('by="chars" wraps between words or after a hyphen, never between letters', async () => {
    const box = document.createElement('div')
    box.style.cssText = 'width: 8ch; font: 20px monospace'
    document.body.append(box)
    const el = await mount(html`<motion-split by="chars">motion-text-mask demo</motion-split>`)
    box.append(el)
    const groups = [...el.querySelectorAll<HTMLElement>(':scope > [aria-hidden]')]
    expect(groups.map((g) => g.textContent)).toEqual(['motion-', 'text-', 'mask', 'demo'])
    for (const group of groups) {
      const tops = [...group.querySelectorAll('[data-unit]')].map(
        (u) => u.getBoundingClientRect().top,
      )
      expect(new Set(tops).size).toBe(1)
    }
    box.remove()
  })

  it('by="lines" groups words into block spans', async () => {
    const el = await mount(html`<motion-split by="lines">One line only</motion-split>`)
    expect(units(el)).toHaveLength(1)
    expect(units(el)[0].textContent).toBe('One line only')
    expect(units(el)[0].style.display).toBe('block')
  })

  for (const by of ['chars', 'words', 'lines']) {
    it(`by="${by}" keeps the full text in one visually hidden span outside the units`, async () => {
      const el = await mount(html`<motion-split by=${by}>Hello brave new world</motion-split>`)
      const [text, ...rest] = spoken(el)
      expect(rest).toHaveLength(0)
      expect(text.textContent).toBe('Hello brave new world')
      expect(text.style.position).toBe('absolute')
      expect(text.style.clipPath).toBe('inset(50%)')
      expect(units(el).some((u) => u === text || u.contains(text) || text.contains(u))).toBe(false)
      expect(el.hasAttribute('aria-label')).toBe(false)
    })
  }

  it('hides each unit at its y offset and observes the first unit', async () => {
    const el = await mount(html`<motion-split y="30">Hello world</motion-split>`)
    for (const s of units(el)) {
      expect(s.style.opacity).toBe('0')
      expect(s.style.transform).toBe('translateY(30px)')
    }
    expect(io.observed).toEqual([units(el)[0]])
    expect(el.playState).toBe('idle')
    expect(animateMock).not.toHaveBeenCalled()
  })

  it('marks empty content ready without observing', async () => {
    const el = await mount(html`<motion-split></motion-split>`)
    expect(el.hasAttribute('data-ready')).toBe(true)
    expect(io.observed).toHaveLength(0)
  })

  it('animates every unit with stagger and spring options on entering view', async () => {
    const el = await mount(
      html`<motion-split interval="0.1" duration="0.8" y="40">Hello world</motion-split>`,
    )
    io.enter()
    expect(el.playState).toBe('running')
    expect(animateMock).toHaveBeenCalledOnce()
    const [targets, keyframes, options] = animateMock.mock.calls[0]
    expect(targets).toEqual(units(el))
    expect(keyframes).toEqual({ opacity: [0, 1], y: [40, 0] })
    expect(staggerMock).toHaveBeenCalledWith(0.1)
    expect(options).toMatchObject({
      delay: { stagger: 0.1 },
      type: 'spring',
      bounce: 0.2,
      duration: 0.8,
    })
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
    io.enter()
    expect(io.observed).toHaveLength(0)
    el.finish()
    io.enter()
    expect(animateMock).toHaveBeenCalledOnce()
  })

  it('once="false" keeps observing after the first reveal', async () => {
    const el = await mount(html`<motion-split once="false">Hello world</motion-split>`)
    expect(el.once).toBe(false)
    io.enter()
    expect(io.observed).toEqual([units(el)[0]])
  })

  it('pause() and play() forward to the Motion controls', async () => {
    const el = await mount()
    io.enter()
    el.pause()
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
    await expect(el.finished).resolves.toBeUndefined()
  })

  it('cancel() stops the animation and restores the hidden state', async () => {
    const el = await mount(html`<motion-split y="25">Hello world</motion-split>`)
    io.enter()
    const cancel = waitForEvent(el, 'motion-cancel')
    el.cancel()
    await cancel
    expect(controls[0].cancel).toHaveBeenCalled()
    expect(el.playState).toBe('idle')
    for (const s of units(el)) {
      expect(s.style.opacity).toBe('0')
      expect(s.style.transform).toBe('translateY(25px)')
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

  it('under reduced motion, shows every unit in its final state without animating', async () => {
    stubReducedMotion(true)
    const el = await mount()
    io.enter()
    expect(animateMock).not.toHaveBeenCalled()
    expect(el.playState).toBe('finished')
    for (const s of units(el)) {
      expect(s.style.opacity).toBe('1')
      expect(s.style.transform).toBe('')
    }
  })

  it('stops observing when disconnected', async () => {
    const el = await mount()
    el.remove()
    expect(io.observed).toHaveLength(0)
  })

  it('with loop, reveals then hides on repeat and keeps running past the first cycle', async () => {
    const el = await mount(html`<motion-split loop hold="0.1" gap="0.1">Hi there</motion-split>`)
    io.enter()
    expect(el.playState).toBe('running')
    await wait(20)

    controls[0].resolve()
    await wait(180)
    expect(animateMock).toHaveBeenCalledTimes(2)
    expect(animateMock.mock.calls[1][1]).toMatchObject({ opacity: [1, 0], y: [0, 20] })

    controls[1].resolve()
    await wait(180)
    expect(el.playState).toBe('running')
  })

  it('with loop, skips the stagger on the hide leg', async () => {
    await mount(html`<motion-split loop hold="0.1" gap="0.1">Hi</motion-split>`)
    io.enter()
    await wait(20)
    expect(staggerMock).toHaveBeenCalledTimes(1)

    controls[0].resolve()
    await wait(180)
    expect(staggerMock).toHaveBeenCalledTimes(1)
  })

  it('with loop, cancels on leave and restarts on the next entry', async () => {
    const el = await mount(html`<motion-split loop hold="4">Hi</motion-split>`)
    io.enter()
    expect(el.playState).toBe('running')

    io.leave()
    expect(el.playState).toBe('idle')
    for (const s of units(el)) expect(s.style.opacity).toBe('0')

    io.enter()
    expect(el.playState).toBe('running')
  })

  it('pauses on hover with pause-on-hover and loop', async () => {
    const el = await mount(html`<motion-split loop hold="0.1" pause-on-hover>Hi</motion-split>`)
    io.enter()
    await waitFor(() => controls.length > 0, 'the first loop leg never started')
    el.dispatchEvent(new Event('pointerenter'))
    expect(controls[controls.length - 1].pause).toHaveBeenCalled()

    el.dispatchEvent(new Event('pointerleave'))
    expect(el.playState).toBe('running')
  })

  it('never starts the loop under reduced motion', async () => {
    stubReducedMotion(true)
    const el = await mount(html`<motion-split loop>Hi</motion-split>`)
    io.enter()
    expect(animateMock).not.toHaveBeenCalled()
    expect(el.playState).toBe('finished')
  })
})
