import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion } from '../../test/helpers.js'
import type { MotionPerspective } from './motion-perspective.js'
import './motion-perspective.js'

// The oscillation runs on a requestAnimationFrame loop, which we replace with
// a manual queue so each frame is stepped with a chosen timestamp.
function stubFrames() {
  let id = 0
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
    step(now: number) {
      const callbacks = [...queue.values()]
      queue.clear()
      callbacks.forEach((cb) => cb(now))
    },
  }
}

const chars = (el: MotionPerspective) => [...el.shadowRoot!.querySelectorAll<HTMLElement>('.char')]
const sizes = (el: MotionPerspective) => chars(el).map((c) => parseFloat(c.style.fontSize))
const opacities = (el: MotionPerspective) => chars(el).map((c) => Number(c.style.opacity))

/** Restart playback with the frame clock pinned at `start` ms. */
function restartAt(el: MotionPerspective, start: number) {
  el.cancel()
  const now = vi.spyOn(performance, 'now').mockReturnValue(start)
  void el.play()
  now.mockRestore()
}

describe('motion-perspective', () => {
  let frames: ReturnType<typeof stubFrames>

  beforeEach(() => {
    stubReducedMotion(false)
    frames = stubFrames()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the text attribute one glyph per span', async () => {
    const el = (await fixture(
      html`<motion-perspective text="Far"></motion-perspective>`,
    )) as MotionPerspective
    expect(chars(el).map((c) => c.textContent)).toEqual(['F', 'a', 'r'])
    expect(el.shadowRoot!.textContent).toContain('F')
  })

  it('takes its text from child text and clears the light DOM', async () => {
    const el = (await fixture(
      html`<motion-perspective> Horizon </motion-perspective>`,
    )) as MotionPerspective
    expect(el.text).toBe('Horizon')
    expect(el.textContent).toBe('')
    expect(chars(el)).toHaveLength(7)
  })

  it('recedes towards the left by depth when static', async () => {
    const el = (await fixture(
      html`<motion-perspective text="ABC" depth="0.5"></motion-perspective>`,
    )) as MotionPerspective
    expect(el.playState).toBe('idle')
    expect(frames.pending).toBe(0)
    expect(sizes(el)).toEqual([0.5, 0.75, 1])
    const [first, middle, last] = opacities(el)
    expect(first).toBeCloseTo(0.775)
    expect(middle).toBeCloseTo(0.8875)
    expect(last).toBe(1)
  })

  it('vanish="right" recedes towards the right', async () => {
    const el = (await fixture(
      html`<motion-perspective text="ABC" depth="0.5" vanish="right"></motion-perspective>`,
    )) as MotionPerspective
    expect(sizes(el)).toEqual([1, 0.75, 0.5])
  })

  it('oscillate="false" stays static', async () => {
    const el = (await fixture(
      html`<motion-perspective text="ABC" depth="0.5" oscillate="false"></motion-perspective>`,
    )) as MotionPerspective
    expect(el.oscillate).toBe(false)
    expect(el.playState).toBe('idle')
    expect(sizes(el)).toEqual([0.5, 0.75, 1])
  })

  it('oscillate starts the loop with a default cycle of 0.667 seconds', async () => {
    const el = (await fixture(
      html`<motion-perspective text="ABC" oscillate></motion-perspective>`,
    )) as MotionPerspective
    expect(el.duration).toBe(0.667)
    expect(el.playState).toBe('running')
    expect(frames.pending).toBe(1)
  })

  it('advances one oscillation cycle per duration seconds', async () => {
    const el = (await fixture(
      html`<motion-perspective text="ABC" depth="0.5" oscillate duration="1"></motion-perspective>`,
    )) as MotionPerspective
    restartAt(el, 1000)
    frames.step(1000)
    expect(sizes(el)[0]).toBeCloseTo(1)
    frames.step(1500)
    expect(sizes(el)[0]).toBeCloseTo(0.5)
    expect(sizes(el)[2]).toBeCloseTo(1)
    frames.step(2000)
    expect(sizes(el)[0]).toBeCloseTo(1)
  })

  it('a longer duration slows the oscillation', async () => {
    const el = (await fixture(
      html`<motion-perspective text="ABC" depth="0.5" oscillate duration="2"></motion-perspective>`,
    )) as MotionPerspective
    restartAt(el, 1000)
    frames.step(1500)
    expect(sizes(el)[0]).toBeCloseTo(0.75)
  })

  it('pause-on-hover stops the loop and resumes on leave', async () => {
    const el = (await fixture(
      html`<motion-perspective text="ABC" oscillate pause-on-hover></motion-perspective>`,
    )) as MotionPerspective
    el.dispatchEvent(new MouseEvent('mouseenter'))
    expect(el.playState).toBe('paused')
    expect(frames.pending).toBe(0)
    el.dispatchEvent(new MouseEvent('mouseleave'))
    expect(el.playState).toBe('running')
    expect(frames.pending).toBe(1)
  })

  it('pause-on-hover="false" keeps oscillating on hover', async () => {
    const el = (await fixture(
      html`<motion-perspective text="ABC" oscillate pause-on-hover="false"></motion-perspective>`,
    )) as MotionPerspective
    el.dispatchEvent(new MouseEvent('mouseenter'))
    expect(el.playState).toBe('running')
  })

  it('pause / play / finish / cancel control the oscillation', async () => {
    const el = (await fixture(
      html`<motion-perspective text="ABC" depth="0.5" oscillate duration="1"></motion-perspective>`,
    )) as MotionPerspective
    restartAt(el, 1000)
    frames.step(1500)
    el.pause()
    expect(el.playState).toBe('paused')
    expect(frames.pending).toBe(0)
    void el.play()
    expect(el.playState).toBe('running')
    expect(frames.pending).toBe(1)
    el.finish()
    expect(el.playState).toBe('finished')
    expect(frames.pending).toBe(0)
    expect(chars(el).every((c) => c.style.fontSize === '')).toBe(true)
    void el.play()
    el.cancel()
    expect(el.playState).toBe('idle')
    expect(frames.pending).toBe(0)
    expect(chars(el).every((c) => c.style.fontSize === '')).toBe(true)
  })

  it('reduced motion shows the static recession instead of oscillating', async () => {
    stubReducedMotion(true)
    const el = (await fixture(
      html`<motion-perspective text="ABC" depth="0.5" oscillate></motion-perspective>`,
    )) as MotionPerspective
    expect(el.playState).toBe('idle')
    expect(frames.pending).toBe(0)
    expect(sizes(el)).toEqual([0.5, 0.75, 1])
  })

  it('exposes the full text to screen readers once', async () => {
    const el = (await fixture(
      html`<motion-perspective text="Read me"></motion-perspective>`,
    )) as HTMLElement
    await elementUpdated(el)
    expect(el.shadowRoot!.querySelector('.sr-only')!.textContent).toBe('Read me')
    expect(el.shadowRoot!.querySelector('.char')!.closest('[aria-hidden="true"]')).not.toBeNull()
  })
})
