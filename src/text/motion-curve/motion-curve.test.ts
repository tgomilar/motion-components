import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion } from '../../test/helpers.js'

// The marquee scroll runs through Motion, so we mock `animate` and assert the
// timing handed to it. The wave runs on a requestAnimationFrame loop, which we
// replace with a manual queue so each frame is stepped deterministically.
const { animateMock, controls } = vi.hoisted(() => {
  const controls = { pause: vi.fn(), play: vi.fn(), complete: vi.fn(), stop: vi.fn() }
  return { controls, animateMock: vi.fn((..._args: unknown[]) => controls) }
})
vi.mock('motion', () => ({ animate: animateMock }))

import type { MotionCurve } from './motion-curve.js'
import './motion-curve.js'

function stubFrames() {
  let id = 0
  let clock = 0
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
  const queue = new Map<number, FrameRequestCallback>()
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    queue.set(++id, cb)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => queue.delete(handle))
  return {
    get pending() {
      return queue.size
    },
    step(count = 1) {
      for (let i = 0; i < count; i++) {
        const callbacks = [...queue.values()]
        queue.clear()
        clock += 1000 / 60
        callbacks.forEach((cb) => cb(clock))
      }
    },
  }
}

const chars = (el: MotionCurve) => [...el.shadowRoot!.querySelectorAll<HTMLElement>('.char')]

/** Vertical wave offset of a glyph, in px. */
const offsetY = (span: HTMLElement) => {
  const match = /translateY\((-?[\d.e-]+)px\)/.exec(span.style.transform)
  if (!match) throw new Error(`no translateY in "${span.style.transform}"`)
  return Number(match[1])
}

describe('motion-curve', () => {
  let frames: ReturnType<typeof stubFrames>

  beforeEach(() => {
    stubReducedMotion(false)
    vi.clearAllMocks()
    frames = stubFrames()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the text attribute one glyph per span', async () => {
    const el = (await fixture(html`<motion-curve text="A B"></motion-curve>`)) as MotionCurve
    expect(chars(el).map((c) => c.textContent)).toEqual(['A', 'B'])
  })

  it('takes its text from child text and clears the light DOM', async () => {
    const el = (await fixture(html`<motion-curve> Wave </motion-curve>`)) as MotionCurve
    expect(el.text).toBe('Wave')
    expect(el.textContent).toBe('')
    expect(el.shadowRoot!.textContent).toContain('W')
    expect(chars(el)).toHaveLength(4)
  })

  it('pads the host by the amplitude unless no-pad is set', async () => {
    const el = (await fixture(
      html`<motion-curve text="Wave" amplitude="10"></motion-curve>`,
    )) as MotionCurve
    expect(el.style.paddingTop).toBe('10px')
    expect(el.style.paddingBottom).toBe('10px')

    const flat = (await fixture(
      html`<motion-curve text="Wave" amplitude="10" no-pad></motion-curve>`,
    )) as MotionCurve
    expect(flat.style.paddingTop).toBe('0px')
  })

  it('completes a quarter wave in a quarter of wave-duration (at 60 frames per second)', async () => {
    const el = (await fixture(
      html`<motion-curve text="Wave" amplitude="10" wave-duration="1"></motion-curve>`,
    )) as MotionCurve
    expect(el.playState).toBe('running')
    frames.step(15)
    expect(offsetY(chars(el)[0])).toBeCloseTo(-10, 5)
  })

  it('a longer wave-duration slows the wave', async () => {
    const el = (await fixture(
      html`<motion-curve text="Wave" amplitude="10" wave-duration="2"></motion-curve>`,
    )) as MotionCurve
    frames.step(15)
    expect(offsetY(chars(el)[0])).toBeCloseTo(-10 * Math.SQRT1_2, 5)
  })

  it('wave-duration="0" holds the wave still', async () => {
    const el = (await fixture(
      html`<motion-curve text="Wave" amplitude="10" wave-duration="0"></motion-curve>`,
    )) as MotionCurve
    frames.step(1)
    const first = chars(el).map((c) => c.style.transform)
    frames.step(20)
    expect(chars(el).map((c) => c.style.transform)).toEqual(first)
    expect(offsetY(chars(el)[0])).toBeCloseTo(0, 5)
  })

  it('shapes the wave from wave-length and amplitude', async () => {
    const el = (await fixture(
      html`<motion-curve
        text="Wave"
        amplitude="12"
        wave-length="100"
        wave-duration="0"
      ></motion-curve>`,
    )) as MotionCurve
    frames.step(1)
    const [first, second] = chars(el)
    const x = second.offsetLeft - first.offsetLeft
    expect(offsetY(second)).toBeCloseTo(12 * Math.sin(((2 * Math.PI) / 100) * x), 5)
  })

  it('pause-on-hover stops the frame loop and resumes on leave', async () => {
    const el = (await fixture(
      html`<motion-curve text="Wave" pause-on-hover></motion-curve>`,
    )) as MotionCurve
    el.dispatchEvent(new PointerEvent('pointermove'))
    expect(el.playState).toBe('paused')
    expect(frames.pending).toBe(0)
    el.dispatchEvent(new PointerEvent('pointerleave'))
    expect(el.playState).toBe('running')
    expect(frames.pending).toBe(1)
  })

  it('pause-on-hover="false" keeps waving on hover', async () => {
    const el = (await fixture(
      html`<motion-curve text="Wave" pause-on-hover="false"></motion-curve>`,
    )) as MotionCurve
    el.dispatchEvent(new PointerEvent('pointermove'))
    expect(el.playState).toBe('running')
  })

  it('pause / play / finish / cancel control the wave loop', async () => {
    const el = (await fixture(html`<motion-curve text="Wave"></motion-curve>`)) as MotionCurve
    el.pause()
    expect(el.playState).toBe('paused')
    expect(frames.pending).toBe(0)
    void el.play()
    expect(el.playState).toBe('running')
    expect(frames.pending).toBe(1)
    el.finish()
    expect(el.playState).toBe('finished')
    expect(frames.pending).toBe(0)
    void el.play()
    el.cancel()
    expect(el.playState).toBe('idle')
    expect(frames.pending).toBe(0)
  })

  it('loop scrolls the track at loop-speed px/s via Motion', async () => {
    const el = (await fixture(
      html`<motion-curve text="endless" loop loop-speed="40" loop-gap="20"></motion-curve>`,
    )) as MotionCurve
    await elementUpdated(el)
    const track = el.shadowRoot!.querySelector<HTMLElement>('.track')!
    const set = el.shadowRoot!.querySelector<HTMLElement>('.set')!
    const loopWidth = set.offsetWidth + 20
    const [target, keyframes, options] = animateMock.mock.calls[animateMock.mock.calls.length - 1]
    expect(target).toBe(track)
    expect(keyframes).toEqual({ x: [0, -loopWidth] })
    expect(options).toMatchObject({ duration: loopWidth / 40, repeat: Infinity, ease: 'linear' })
    el.pause()
    expect(controls.pause).toHaveBeenCalledOnce()
    void el.play()
    expect(controls.play).toHaveBeenCalledOnce()
  })

  it('loop exposes the text once to screen readers and hides the copies', async () => {
    const el = (await fixture(
      html`<motion-curve text="endless" loop></motion-curve>`,
    )) as MotionCurve
    await elementUpdated(el)
    const sets = [...el.shadowRoot!.querySelectorAll('.set')]
    expect(sets.length).toBeGreaterThanOrEqual(2)
    expect(el.shadowRoot!.querySelector('.sr-only')!.textContent).toBe('endless')
    expect(el.shadowRoot!.querySelector('.track')!.getAttribute('aria-hidden')).toBe('true')
  })

  it('reduced motion leaves the text flat without animating', async () => {
    stubReducedMotion(true)
    const el = (await fixture(
      html`<motion-curve text="endless" loop></motion-curve>`,
    )) as MotionCurve
    await elementUpdated(el)
    expect(el.playState).toBe('finished')
    expect(frames.pending).toBe(0)
    expect(animateMock).not.toHaveBeenCalled()
    expect(chars(el).every((c) => c.style.transform === '')).toBe(true)
  })
})
