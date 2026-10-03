import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion } from '../../test/helpers.js'

// Parallax is scroll-driven; real scroll progress is not deterministically
// triggerable in this harness. Its observable contract is that it wires
// motion's `animate` + `scroll` on connect, so we mock both and assert on the
// wiring / decision logic rather than interpolated frames.
const { animateMock, scrollMock } = vi.hoisted(() => ({
  animateMock: vi.fn((..._args: unknown[]) => ({ stop: vi.fn() })),
  scrollMock: vi.fn((..._args: unknown[]) => () => {}),
}))
vi.mock('motion', () => ({ animate: animateMock, scroll: scrollMock }))

import type { MotionParallax } from './motion-parallax.js'
import './motion-parallax.js'

describe('motion-parallax', () => {
  beforeEach(() => {
    stubReducedMotion(false)
    animateMock.mockClear()
    scrollMock.mockClear()
  })

  async function mount() {
    return (await fixture(
      html`<motion-parallax depth="0.3" axis="y"><img alt="" /></motion-parallax>`,
    )) as MotionParallax
  }

  it('upgrades, renders a slot, and exposes prop defaults', async () => {
    const el = (await fixture(
      html`<motion-parallax><img alt="" /></motion-parallax>`,
    )) as MotionParallax
    expect(el.shadowRoot?.querySelector('slot')).toBeTruthy()
    expect(el.depth).toBe(0.5)
    expect(el.axis).toBe('y')
    expect(el.container).toBe('')
  })

  it('binds motion scroll+animate on connect and starts running', async () => {
    const el = await mount()
    expect(el.playState).toBe('running')
    expect(animateMock).toHaveBeenCalled()
    expect(scrollMock).toHaveBeenCalled()
    // scroll targets the element with a start/end offset range
    const scrollOptions = scrollMock.mock.calls[0][1] as { target: unknown; offset: unknown }
    expect(scrollOptions.target).toBe(el)
    expect(scrollOptions.offset).toEqual(['start end', 'end start'])
  })

  it('derives keyframes from depth and axis', async () => {
    const el = await mount()
    // depth 0.3 * range 80 = 24px along the y axis
    const [target, keyframes] = animateMock.mock.calls[0]
    expect(target).toBe(el)
    expect(keyframes).toEqual({ y: ['24px', '-24px'] })
  })

  it('does not animate when reduced motion is preferred', async () => {
    stubReducedMotion(true)
    const el = await mount()
    expect(animateMock).not.toHaveBeenCalled()
    expect(scrollMock).not.toHaveBeenCalled()
    expect(el.playState).toBe('idle')
  })

  it('applies the final translate offset on finish()', async () => {
    const el = await mount()
    el.finish()
    await elementUpdated(el)
    // final state is -(depth * 80) => -24px along y
    expect(el.style.transform).toBe('translateY(-24px)')
    expect(el.playState).toBe('finished')
  })
})
