import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fixture } from '@open-wc/testing-helpers'
import { stubReducedMotion } from '../../test/helpers.js'

// The spread runs through Motion's spring; the contract is the per-character
// x target and spring options handed to `animate`, so we mock it.
const { animateMock } = vi.hoisted(() => ({
  animateMock: vi.fn((..._args: unknown[]) => ({ stop: vi.fn() })),
}))
vi.mock('motion', () => ({ animate: animateMock }))

import type { MotionStretch } from './motion-stretch.js'
import './motion-stretch.js'

type Controls = ReturnType<typeof animateMock>

const chars = (el: MotionStretch) => [...el.shadowRoot!.querySelectorAll<HTMLElement>('.char')]
const controls = () => animateMock.mock.results.map((r) => r.value as Controls)

describe('motion-stretch', () => {
  beforeEach(() => {
    stubReducedMotion(false)
    animateMock.mockClear()
  })

  async function mount(attrs = '', text = 'ABC') {
    const host = document.createElement('div')
    host.innerHTML = `<motion-stretch ${attrs}>${text}</motion-stretch>`
    return (await fixture(host.firstElementChild!)) as MotionStretch
  }

  it('exposes the full text to screen readers and hides the character track', async () => {
    const el = await mount('', 'HI THERE')
    expect(el.shadowRoot!.querySelector('.sr-only')!.textContent).toBe('HI THERE')
    expect(el.shadowRoot!.querySelector('.track')!.getAttribute('aria-hidden')).toBe('true')
    expect(el.textContent).toBe('')
  })

  it('renders one span per character, spaces as non-breaking', async () => {
    const el = await mount('', 'A B')
    expect(chars(el).map((c) => c.textContent)).toEqual(['A', ' ', 'B'])
  })

  it('prefers the text attribute over child text', async () => {
    const el = await mount('text="XY"', 'ignored')
    expect(el.text).toBe('XY')
    expect(chars(el)).toHaveLength(2)
  })

  it('has defaults: spread 12, spring duration 0.45, bounce 0.55', async () => {
    const el = await mount()
    expect(el.spread).toBe(12)
    expect(el.duration).toBe(0.45)
    expect(el.bounce).toBe(0.55)
  })

  it('springs characters outward from the centre on mouseenter', async () => {
    const el = await mount('spread="10"')
    el.dispatchEvent(new MouseEvent('mouseenter'))
    expect(animateMock).toHaveBeenCalledTimes(3)
    const calls = animateMock.mock.calls
    expect(calls.map((c) => c[0])).toEqual(chars(el))
    expect(calls.map((c) => c[1])).toEqual([{ x: -10 }, { x: 0 }, { x: 10 }])
    for (const c of calls) {
      expect(c[2]).toEqual({ type: 'spring', duration: 0.45, bounce: 0.55 })
    }
  })

  it('passes custom spring duration and bounce to Motion', async () => {
    const el = await mount('duration="0.8" bounce="0.2"')
    el.dispatchEvent(new MouseEvent('mouseenter'))
    expect(animateMock.mock.calls[0][2]).toEqual({ type: 'spring', duration: 0.8, bounce: 0.2 })
  })

  it('keeps a single character centred', async () => {
    const el = await mount('', 'A')
    el.dispatchEvent(new MouseEvent('mouseenter'))
    expect(animateMock.mock.calls[0][1]).toEqual({ x: 0 })
  })

  it('interrupts the spread and springs back to rest on mouseleave', async () => {
    const el = await mount()
    el.dispatchEvent(new MouseEvent('mouseenter'))
    const spread = controls()
    animateMock.mockClear()

    el.dispatchEvent(new MouseEvent('mouseleave'))
    for (const c of spread) expect(c.stop).toHaveBeenCalledOnce()
    expect(animateMock).toHaveBeenCalledTimes(3)
    for (const c of animateMock.mock.calls) {
      expect(c[1]).toEqual({ x: 0 })
      expect(c[2]).toEqual({ type: 'spring', duration: 0.45, bounce: 0.55 })
    }
  })

  it('interrupts a running spread when re-entered', async () => {
    const el = await mount()
    el.dispatchEvent(new MouseEvent('mouseenter'))
    const first = controls()
    el.dispatchEvent(new MouseEvent('mouseenter'))
    for (const c of first) expect(c.stop).toHaveBeenCalledOnce()
  })

  it('stops running springs and stops listening when disconnected', async () => {
    const el = await mount()
    el.dispatchEvent(new MouseEvent('mouseenter'))
    const running = controls()
    el.remove()
    for (const c of running) expect(c.stop).toHaveBeenCalledOnce()

    animateMock.mockClear()
    el.dispatchEvent(new MouseEvent('mouseenter'))
    expect(animateMock).not.toHaveBeenCalled()
  })

  it('under reduced motion, does not spread and snaps back without a spring', async () => {
    stubReducedMotion(true)
    const el = await mount()
    el.dispatchEvent(new MouseEvent('mouseenter'))
    expect(animateMock).not.toHaveBeenCalled()

    el.dispatchEvent(new MouseEvent('mouseleave'))
    expect(animateMock).toHaveBeenCalledTimes(3)
    for (const c of animateMock.mock.calls) {
      expect(c[1]).toEqual({ x: 0 })
      expect(c[2]).toEqual({ duration: 0 })
    }
  })
})
