import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion } from '../../test/helpers.js'

// Magnetic pulls slotted content toward the cursor via Motion's spring; its
// *contract* is the x/y offset it hands to `animate`, so we mock `animate` and
// assert on the computed target rather than interpolated frames.
const { animateMock } = vi.hoisted(() => ({ animateMock: vi.fn() }))
vi.mock('motion', () => ({ animate: animateMock }))

import type { MotionMagnetic } from './motion-magnetic.js'
import './motion-magnetic.js'

describe('motion-magnetic', () => {
  beforeEach(() => {
    stubReducedMotion(false)
    animateMock.mockClear()
  })

  async function mount() {
    return (await fixture(
      html`<motion-magnetic strength="0.5"><a href="/x">Link</a></motion-magnetic>`,
    )) as MotionMagnetic
  }

  it('pulls toward the cursor by strength on mousemove', async () => {
    const el = await mount()
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    el.dispatchEvent(new MouseEvent('mousemove', { clientX: cx + 100, clientY: cy + 40 }))

    expect(animateMock).toHaveBeenCalledOnce()
    const [target, keyframes] = animateMock.mock.calls[0]
    expect(target).toBe(el)
    // strength 0.5 of the offset from center (subpixel layout tolerance).
    expect(keyframes.x).toBeCloseTo(50, 0)
    expect(keyframes.y).toBeCloseTo(20, 0)
  })

  it('settles back to rest on mouseleave', async () => {
    const el = await mount()
    el.dispatchEvent(new MouseEvent('mousemove', { clientX: 999, clientY: 999 }))
    animateMock.mockClear()
    el.dispatchEvent(new MouseEvent('mouseleave'))
    expect(animateMock).toHaveBeenCalledOnce()
    const [, keyframes] = animateMock.mock.calls[0]
    expect(keyframes).toMatchObject({ x: 0, y: 0 })
  })

  it('ignores pointer input while disabled and reflects the attribute', async () => {
    const el = await mount()
    el.disabled = true
    await elementUpdated(el)
    expect(el.hasAttribute('disabled')).toBe(true)

    animateMock.mockClear()
    el.dispatchEvent(new MouseEvent('mousemove', { clientX: 999, clientY: 999 }))
    expect(animateMock).not.toHaveBeenCalled()
  })

  it('does nothing when reduced motion is preferred', async () => {
    stubReducedMotion(true)
    const el = await mount()
    el.dispatchEvent(new MouseEvent('mousemove', { clientX: 999, clientY: 999 }))
    expect(animateMock).not.toHaveBeenCalled()
  })

  it('settles to rest when disabled while pulled', async () => {
    const el = await mount()
    el.dispatchEvent(new MouseEvent('mousemove', { clientX: 999, clientY: 999 }))
    animateMock.mockClear()
    el.disabled = true
    await elementUpdated(el)
    expect(animateMock).toHaveBeenCalledOnce()
    const [, keyframes] = animateMock.mock.calls[0]
    expect(keyframes).toMatchObject({ x: 0, y: 0 })
  })
})
