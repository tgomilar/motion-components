import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fixture, html } from '@open-wc/testing-helpers'
import { stubReducedMotion } from '../../test/helpers.js'

// The jitter runs through Motion; the contract is the keyframes and timing
// handed to `animate` per burst, and how bursts are settled, so we mock it.
const { animateMock } = vi.hoisted(() => {
  const burst = () => ({
    complete: vi.fn(),
    cancel: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    play: vi.fn(),
  })
  return { animateMock: vi.fn((..._args: unknown[]) => burst()) }
})
vi.mock('motion', () => ({ animate: animateMock }))

import type { MotionGlitch } from './motion-glitch.js'
import './motion-glitch.js'

type Burst = ReturnType<typeof animateMock>

const layer = (el: MotionGlitch, name: 'main' | 'r' | 'b') =>
  el.querySelector<HTMLElement>(`[data-mg-${name}]`)!

const lastBursts = () => animateMock.mock.results.slice(-3).map((r) => r.value as Burst)

describe('motion-glitch', () => {
  beforeEach(() => {
    stubReducedMotion(false)
    animateMock.mockClear()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function mount(attrs = '') {
    const el = document.createElement('div')
    el.innerHTML = `<motion-glitch ${attrs}>ERROR_404</motion-glitch>`
    return (await fixture(el.firstElementChild!)) as MotionGlitch
  }

  it('keeps the text readable once and hides the RGB layers from screen readers', async () => {
    const el = await mount('trigger="hover"')
    expect(layer(el, 'main').textContent).toBe('ERROR_404')
    expect(layer(el, 'main').hasAttribute('aria-hidden')).toBe(false)
    expect(layer(el, 'r').getAttribute('aria-hidden')).toBe('true')
    expect(layer(el, 'b').getAttribute('aria-hidden')).toBe('true')
    expect(el.shadowRoot!.querySelector('slot')).not.toBeNull()
  })

  it('has loop defaults: intensity 5, interval 2s, reflected trigger', async () => {
    const el = await mount()
    expect(el.intensity).toBe(5)
    expect(el.interval).toBe(2)
    expect(el.trigger).toBe('loop')
    expect(el.getAttribute('trigger')).toBe('loop')
  })

  it('does nothing when there is no text', async () => {
    const el = (await fixture(html`<motion-glitch></motion-glitch>`)) as MotionGlitch
    expect(el.querySelector('[data-mg-main]')).toBeNull()
    expect(animateMock).not.toHaveBeenCalled()
  })

  it('hands the RGB jitter keyframes scaled by intensity to animate', async () => {
    const el = await mount('trigger="hover" intensity="10"')
    el.glitch()
    expect(animateMock).toHaveBeenCalledTimes(3)
    const [r, b, main] = animateMock.mock.calls

    expect(r[0]).toBe(layer(el, 'r'))
    expect(r[1]).toEqual({
      x: [0, 14, -9, 20, -11, 0],
      opacity: [0, 0.9, 0.65, 0.95, 0.75, 0],
    })
    expect(r[2]).toEqual({ duration: 0.38, ease: 'linear' })

    expect(b[0]).toBe(layer(el, 'b'))
    expect(b[1]).toEqual({
      x: [0, -10, 16, -13, 7, 0],
      opacity: [0, 0.8, 0.95, 0.6, 0.85, 0],
    })

    expect(main[0]).toBe(layer(el, 'main'))
    expect(main[1]).toEqual({ x: [0, -3, 5, -2.5, 0] })
    expect(main[2]).toMatchObject({ ease: 'linear' })
    expect((main[2] as { duration: number }).duration).toBeCloseTo(0.38 * 0.65)
  })

  it('hover trigger bursts on pointerenter only, as a playback run with events', async () => {
    const el = await mount('trigger="hover"')
    expect(animateMock).not.toHaveBeenCalled()
    expect(el.playState).toBe('idle')
    let started = 0
    el.addEventListener('motion-start', () => started++)
    el.dispatchEvent(new PointerEvent('pointerenter'))
    expect(animateMock).toHaveBeenCalledTimes(3)
    expect(started).toBe(1)
    expect(['running', 'finished']).toContain(el.playState)
  })

  it('mount trigger bursts once and does not repeat', async () => {
    await mount('trigger="mount"')
    expect(animateMock).toHaveBeenCalledTimes(3)
    vi.advanceTimersByTime(10_000)
    expect(animateMock).toHaveBeenCalledTimes(3)
  })

  it('loop trigger plays on mount and bursts again every interval seconds', async () => {
    const el = await mount('interval="0.5"')
    expect(el.playState).toBe('running')
    expect(animateMock).toHaveBeenCalledTimes(3)

    vi.advanceTimersByTime(499)
    expect(animateMock).toHaveBeenCalledTimes(3)
    vi.advanceTimersByTime(1)
    expect(animateMock).toHaveBeenCalledTimes(6)
    vi.advanceTimersByTime(500)
    expect(animateMock).toHaveBeenCalledTimes(9)
  })

  it('pause() holds the loop and play() resumes with the remaining time', async () => {
    const el = await mount()
    vi.advanceTimersByTime(1500)
    el.pause()
    expect(el.playState).toBe('paused')
    vi.advanceTimersByTime(5000)
    expect(animateMock).toHaveBeenCalledTimes(3)

    void el.play()
    expect(el.playState).toBe('running')
    vi.advanceTimersByTime(499)
    expect(animateMock).toHaveBeenCalledTimes(3)
    vi.advanceTimersByTime(1)
    expect(animateMock).toHaveBeenCalledTimes(6)
  })

  it('finish() completes in-flight bursts and stops the loop', async () => {
    const el = await mount()
    const bursts = lastBursts()
    el.finish()
    expect(el.playState).toBe('finished')
    for (const b of bursts) expect(b.complete).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(10_000)
    expect(animateMock).toHaveBeenCalledTimes(3)
  })

  it('cancel() cancels in-flight bursts and returns to idle', async () => {
    const el = await mount()
    const bursts = lastBursts()
    el.cancel()
    expect(el.playState).toBe('idle')
    for (const b of bursts) expect(b.cancel).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(10_000)
    expect(animateMock).toHaveBeenCalledTimes(3)
  })

  it('stops looping once disconnected', async () => {
    const el = await mount()
    el.remove()
    vi.advanceTimersByTime(10_000)
    expect(animateMock).toHaveBeenCalledTimes(3)
  })

  it('under reduced motion, never animates and settles loop playback', async () => {
    stubReducedMotion(true)
    const el = await mount()
    expect(el.playState).toBe('finished')
    vi.advanceTimersByTime(10_000)
    el.glitch()
    expect(animateMock).not.toHaveBeenCalled()

    const hover = await mount('trigger="hover"')
    hover.dispatchEvent(new MouseEvent('mouseenter'))
    expect(animateMock).not.toHaveBeenCalled()
  })

  it('hover trigger still bursts after it is removed and added back', async () => {
    const el = await mount('trigger="hover"')
    const parent = el.parentElement!
    el.remove()
    parent.append(el)
    let started = 0
    el.addEventListener('motion-start', () => started++)
    el.dispatchEvent(new PointerEvent('pointerenter'))
    expect(started).toBe(1)
  })
})
