import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fixture } from '@open-wc/testing-helpers'
import type * as Motion from 'motion'
import { stubReducedMotion, stubIntersectionObserver } from '../../test/helpers.js'
import type { IntersectionHandle } from '../../test/helpers.js'

// Axis values are tweened by Motion and scroll-mapped by Motion's `scroll`;
// the contract is the targets, spring options and scroll wiring, so we mock both.
const { animateMock, scrollMock, scrollCleanup, settle, forget } = vi.hoisted(() => {
  const scrollCleanup = vi.fn()
  const pending: (() => void)[] = []
  return {
    scrollCleanup,
    settle: () => pending.splice(0).forEach((fn) => fn()),
    // Settled animations from a finished test must not resolve a later one.
    forget: () => pending.splice(0),
    animateMock: vi.fn((..._args: unknown[]) => {
      let resolve!: () => void
      const done = new Promise<void>((r) => (resolve = r))
      pending.push(resolve)
      return {
        then: (ok: () => void, fail?: (e: unknown) => void) => done.then(ok, fail),
        pause: vi.fn(),
        play: vi.fn(),
        complete: vi.fn(),
        cancel: vi.fn(),
        stop: vi.fn(),
      }
    }),
    scrollMock: vi.fn((..._args: unknown[]) => scrollCleanup),
  }
})
vi.mock('motion', async (importOriginal) => ({
  ...(await importOriginal<typeof Motion>()),
  animate: animateMock,
  scroll: scrollMock,
}))

import type { MotionFont } from './motion-font.js'
import './motion-font.js'

type Controls = ReturnType<typeof animateMock>
type Options = { onUpdate: () => void } & Record<string, unknown>

const props = (el: MotionFont) =>
  [...el.style.fontVariationSettings.matchAll(/var\((--mc-_font-[\d-]+)\)/g)].map((m) => m[1])

const axisValue = (el: MotionFont, i = 0) => Number(el.style.getPropertyValue(props(el)[i]))

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const controlsAt = (i: number) => animateMock.mock.results[i].value as Controls

describe('motion-font', () => {
  let io: IntersectionHandle

  beforeEach(() => {
    stubReducedMotion(false)
    io = stubIntersectionObserver()
    animateMock.mockClear()
    scrollMock.mockClear()
    scrollCleanup.mockClear()
    forget()
  })

  afterEach(() => {
    for (const el of document.querySelectorAll('motion-font')) el.remove()
  })

  async function mount(attrs = '') {
    const host = document.createElement('div')
    host.innerHTML = `<motion-font ${attrs}>Variable font</motion-font>`
    return (await fixture(host.firstElementChild!)) as MotionFont
  }

  it('keeps its text in the light DOM, projected through a slot', async () => {
    const el = await mount()
    expect(el.textContent).toBe('Variable font')
    expect(el.shadowRoot!.querySelector('slot')).not.toBeNull()
  })

  it('defaults to a wght 300 to 700 view trigger with once on', async () => {
    const el = await mount()
    expect(el.axis).toBe('wght')
    expect(el.from).toBe(300)
    expect(el.to).toBe(700)
    expect(el.duration).toBe(0.6)
    expect(el.bounce).toBe(0)
    expect(el.delay).toBe(0)
    expect(el.once).toBe(true)
    expect(el.getAttribute('trigger')).toBe('view')
    expect(el.style.fontVariationSettings).toMatch(/^["']wght["'] var\(--mc-_font-\d+\)$/)
    expect(axisValue(el)).toBe(300)
  })

  it('parses a multi-axis spec into one custom property per axis', async () => {
    const el = await mount('axes="wght:300:800 slnt:0:-12"')
    expect(el.style.fontVariationSettings).toMatch(
      /["']wght["'] var\(--mc-_font-\d+-0\), ["']slnt["'] var\(--mc-_font-\d+-1\)/,
    )
    expect(axisValue(el, 0)).toBe(300)
    expect(axisValue(el, 1)).toBe(0)
  })

  it('view trigger observes the viewport and springs to `to` on entry', async () => {
    const el = await mount('from="200" to="900" duration="0.8" bounce="0.3" delay="0.1"')
    expect(io.observed).toContain(el)
    expect(animateMock).not.toHaveBeenCalled()

    io.enter()
    expect(el.playState).toBe('running')
    expect(animateMock).toHaveBeenCalledOnce()
    const [obj, keyframes, options] = animateMock.mock.calls[0] as [
      { value: number },
      unknown,
      Options,
    ]
    expect(obj).toEqual({ value: 200 })
    expect(keyframes).toEqual({ value: 900 })
    expect(options).toMatchObject({ type: 'spring', duration: 0.8, bounce: 0.3, delay: 0.1 })

    obj.value = 550
    options.onUpdate()
    expect(axisValue(el)).toBe(550)
  })

  it('animates every axis of a multi-axis spec', async () => {
    await mount('axes="wght:300:800 slnt:0:-12"')
    io.enter()
    expect(animateMock).toHaveBeenCalledTimes(2)
    expect(animateMock.mock.calls[0].slice(0, 2)).toEqual([{ value: 300 }, { value: 800 }])
    expect(animateMock.mock.calls[1].slice(0, 2)).toEqual([{ value: 0 }, { value: -12 }])
  })

  it('stops observing after the first entry by default', async () => {
    const el = await mount()
    io.enter()
    expect(io.observed).not.toContain(el)
  })

  it('once="false" keeps observing after entry', async () => {
    const el = await mount('once="false"')
    expect(el.once).toBe(false)
    io.enter()
    expect(io.observed).toContain(el)
  })

  it('finish() completes the spring; cancel() reverts to `from` and idles', async () => {
    const el = await mount()
    io.enter()
    el.finish()
    expect(controlsAt(0).complete).toHaveBeenCalledOnce()
    expect(el.playState).toBe('finished')

    el.cancel()
    expect(el.playState).toBe('idle')
    expect(axisValue(el)).toBe(300)
  })

  it('pause() pauses the spring and play() resumes it', async () => {
    const el = await mount()
    io.enter()
    el.pause()
    expect(el.playState).toBe('paused')
    expect(controlsAt(0).pause).toHaveBeenCalledOnce()
    void el.play()
    expect(el.playState).toBe('running')
    expect(controlsAt(0).play).toHaveBeenCalledOnce()
  })

  it('replay() resets to `from` and re-arms the viewport observer', async () => {
    const el = await mount()
    io.enter()
    el.finish()
    el.replay()
    expect(el.playState).toBe('idle')
    expect(axisValue(el)).toBe(300)
    expect(io.observed).toContain(el)

    io.enter()
    expect(el.playState).toBe('running')
    expect(animateMock).toHaveBeenCalledTimes(2)
  })

  it('hover trigger springs to `to` on enter/focus and back to `from` on leave/blur', async () => {
    const el = await mount('trigger="hover" from="100" to="900"')
    expect(io.observed).toHaveLength(0)
    expect(el.playState).toBe('idle')

    el.dispatchEvent(new MouseEvent('mouseenter'))
    expect(animateMock.mock.calls[0].slice(0, 2)).toEqual([{ value: 100 }, { value: 900 }])
    expect(animateMock.mock.calls[0][2]).toMatchObject({ type: 'spring', duration: 0.6 })

    el.dispatchEvent(new MouseEvent('mouseleave'))
    expect(controlsAt(0).stop).toHaveBeenCalledOnce()
    expect(animateMock.mock.calls[1][1]).toEqual({ value: 100 })

    el.dispatchEvent(new FocusEvent('focusin'))
    expect(controlsAt(1).stop).toHaveBeenCalledOnce()
    expect(animateMock.mock.calls[2][1]).toEqual({ value: 900 })
    el.dispatchEvent(new FocusEvent('focusout'))
    expect(animateMock.mock.calls[3][1]).toEqual({ value: 100 })
  })

  it('scroll trigger maps scroll progress onto the axis range', async () => {
    const el = await mount('trigger="scroll" from="200" to="800"')
    expect(io.observed).toHaveLength(0)
    expect(el.playState).toBe('running')
    expect(scrollMock).toHaveBeenCalledOnce()
    const [onProgress, options] = scrollMock.mock.calls[0] as [(p: number) => void, unknown]
    expect(options).toEqual({ target: el, offset: ['start end', 'end start'] })

    onProgress(0.5)
    expect(axisValue(el)).toBe(500)
    onProgress(1)
    expect(axisValue(el)).toBe(800)
  })

  it('scroll trigger unbinds on pause, rebinds on play and jumps to `to` on finish', async () => {
    const el = await mount('trigger="scroll"')
    el.pause()
    expect(scrollCleanup).toHaveBeenCalledOnce()
    void el.play()
    expect(scrollMock).toHaveBeenCalledTimes(2)

    el.finish()
    expect(scrollCleanup).toHaveBeenCalledTimes(2)
    expect(axisValue(el)).toBe(700)
    expect(el.playState).toBe('finished')
  })

  it('scroll trigger unbinds on disconnect', async () => {
    const el = await mount('trigger="scroll"')
    el.remove()
    expect(scrollCleanup).toHaveBeenCalled()
  })

  it('under reduced motion, shows the `to` state without observing or animating', async () => {
    stubReducedMotion(true)
    const view = await mount('to="900"')
    expect(axisValue(view)).toBe(900)
    expect(io.observed).toHaveLength(0)

    const scrolled = await mount('trigger="scroll" to="800"')
    expect(axisValue(scrolled)).toBe(800)
    expect(scrollMock).not.toHaveBeenCalled()
    expect(animateMock).not.toHaveBeenCalled()
  })

  it('controls every axis, not just the first', async () => {
    const el = await mount('axes="wght:300:800 slnt:0:-12"')
    io.enter()
    expect(animateMock).toHaveBeenCalledTimes(2)
    const [a, b] = animateMock.mock.results.map((r) => r.value as Controls)
    el.pause()
    expect(a.pause).toHaveBeenCalled()
    expect(b.pause).toHaveBeenCalled()
  })

  it('hover out stops every axis spring from hover in', async () => {
    const el = await mount('trigger="hover" axes="wght:300:800 slnt:0:-12"')
    el.dispatchEvent(new MouseEvent('mouseenter'))
    const [a, b] = animateMock.mock.results.map((r) => r.value as Controls)
    el.dispatchEvent(new MouseEvent('mouseleave'))
    expect(a.stop).toHaveBeenCalled()
    expect(b.stop).toHaveBeenCalled()
  })

  it('with loop, runs to `to` then springs back to `from` on repeat', async () => {
    const el = await mount('axis="wght" from="300" to="700" loop hold="0.1" gap="0.1"')
    io.enter()
    expect(el.playState).toBe('running')

    await wait(20)
    expect(animateMock.mock.calls[0][1]).toEqual({ value: 700 })
    settle()
    await wait(180)

    expect(animateMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(animateMock.mock.calls[1][1]).toEqual({ value: 300 })
    expect(el.playState).toBe('running')
  })

  it('with loop, cancels on leave and restarts on the next entry', async () => {
    const el = await mount('loop hold="4"')
    io.enter()
    expect(el.playState).toBe('running')

    io.leave()
    expect(el.playState).toBe('idle')
    expect(axisValue(el)).toBe(300)

    io.enter()
    expect(el.playState).toBe('running')
  })

  it('pauses on hover with pause-on-hover and loop', async () => {
    const el = await mount('loop hold="4" gap="4" pause-on-hover')
    io.enter()
    await wait(20)

    el.dispatchEvent(new Event('pointermove'))
    expect(el.playState).toBe('paused')
    const callsWhilePaused = animateMock.mock.calls.length
    await wait(150)
    expect(animateMock.mock.calls.length).toBe(callsWhilePaused)

    el.dispatchEvent(new Event('pointerleave'))
    expect(el.playState).toBe('running')
  })

  it('never starts the loop under reduced motion', async () => {
    stubReducedMotion(true)
    const el = await mount('loop')
    io.enter()
    expect(animateMock).not.toHaveBeenCalled()
    expect(axisValue(el)).toBe(700)
  })

  it('hover respects reduced motion', async () => {
    stubReducedMotion(true)
    const el = await mount('trigger="hover"')
    el.dispatchEvent(new MouseEvent('mouseenter'))
    expect(animateMock).not.toHaveBeenCalled()
    expect(axisValue(el)).toBe(700)
  })
})
