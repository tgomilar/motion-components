import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion } from '../../test/helpers.js'

// Hover applies transforms through Motion's spring; the component's *contract*
// is which values it hands to `animate` and when, so we mock `animate` and
// assert on the decision logic rather than interpolated frames.
const { animateMock } = vi.hoisted(() => ({ animateMock: vi.fn() }))
vi.mock('motion', () => ({ animate: animateMock }))

import type { MotionHover } from './motion-hover.js'
import './motion-hover.js'

describe('motion-hover', () => {
  beforeEach(() => {
    stubReducedMotion(false)
    animateMock.mockClear()
  })

  async function mount() {
    return (await fixture(
      html`<motion-hover scale="1.08" rotate="-2"><button>Hover</button></motion-hover>`,
    )) as MotionHover
  }

  it('animates to the configured transform on mouseenter', async () => {
    const el = await mount()
    el.dispatchEvent(new MouseEvent('mouseenter'))
    expect(animateMock).toHaveBeenCalledOnce()
    const [target, keyframes] = animateMock.mock.calls[0]
    expect(target).toBe(el)
    expect(keyframes).toMatchObject({ scale: 1.08, rotate: -2, x: 0, y: 0 })
  })

  it('settles back to rest on mouseleave', async () => {
    const el = await mount()
    el.dispatchEvent(new MouseEvent('mouseenter'))
    animateMock.mockClear()
    el.dispatchEvent(new MouseEvent('mouseleave'))
    const [, keyframes] = animateMock.mock.calls[0]
    expect(keyframes).toMatchObject({ scale: 1, x: 0, y: 0, rotate: 0, skewX: 0 })
  })

  it('ignores pointer input while disabled and reflects the attribute', async () => {
    const el = await mount()
    el.disabled = true
    await elementUpdated(el)
    expect(el.hasAttribute('disabled')).toBe(true)

    animateMock.mockClear()
    el.dispatchEvent(new MouseEvent('mouseenter'))
    expect(animateMock).not.toHaveBeenCalled()
  })

  it('does nothing when reduced motion is preferred', async () => {
    stubReducedMotion(true)
    const el = await mount()
    el.dispatchEvent(new MouseEvent('mouseenter'))
    expect(animateMock).not.toHaveBeenCalled()
  })

  it('settles to rest when disabled while hovered', async () => {
    const el = await mount()
    el.dispatchEvent(new MouseEvent('mouseenter'))
    animateMock.mockClear()
    el.disabled = true
    await elementUpdated(el)
    const [, keyframes] = animateMock.mock.calls[0]
    expect(keyframes).toMatchObject({ scale: 1, rotate: 0 })
  })
})
