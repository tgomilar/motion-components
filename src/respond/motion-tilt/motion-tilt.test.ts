import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion } from '../../test/helpers.js'

// Tilt rotates its inner wrapper via Motion's spring based on cursor position;
// its *contract* is the rotateX/rotateY/scale it hands to `animate`, so we mock
// `animate` and assert on the computed target rather than interpolated frames.
const { animateMock } = vi.hoisted(() => ({ animateMock: vi.fn() }))
vi.mock('motion', () => ({ animate: animateMock }))

import type { MotionTilt } from './motion-tilt.js'
import './motion-tilt.js'

describe('motion-tilt', () => {
  beforeEach(() => {
    stubReducedMotion(false)
    animateMock.mockClear()
  })

  async function mount(gloss = false) {
    return (await fixture(
      html`<motion-tilt max="20" scale="1.05" ?gloss=${gloss}
        ><div style="width:100px;height:100px">Card</div></motion-tilt
      >`,
    )) as MotionTilt
  }

  it('tilts the inner wrapper based on cursor position on mousemove', async () => {
    const el = await mount()
    const rect = el.getBoundingClientRect()
    // Cursor at top-left corner: px=0, py=0 -> rotateX = +max, rotateY = -max.
    el.dispatchEvent(new MouseEvent('mousemove', { clientX: rect.left, clientY: rect.top }))

    expect(animateMock).toHaveBeenCalledOnce()
    const [target, keyframes, options] = animateMock.mock.calls[0]
    expect(target).not.toBe(el)
    // px=0, py=0 at top-left corner -> rotateX = +max, rotateY = -max.
    expect(keyframes.rotateX).toBeCloseTo(20, 5)
    expect(keyframes.rotateY).toBeCloseTo(-20, 5)
    expect(keyframes.scale).toBe(1.05)
    expect(options).toMatchObject({ type: 'spring' })
  })

  it('settles rotation and scale to rest on mouseleave', async () => {
    const el = await mount()
    const rect = el.getBoundingClientRect()
    el.dispatchEvent(new MouseEvent('mousemove', { clientX: rect.left, clientY: rect.top }))
    animateMock.mockClear()
    el.dispatchEvent(new MouseEvent('mouseleave'))
    expect(animateMock).toHaveBeenCalledOnce()
    const [, keyframes] = animateMock.mock.calls[0]
    expect(keyframes).toMatchObject({ rotateX: 0, rotateY: 0, scale: 1 })
  })

  it('fades the gloss overlay in on mouseenter when gloss is enabled', async () => {
    const el = await mount(true)
    el.dispatchEvent(new MouseEvent('mouseenter'))
    expect(animateMock).toHaveBeenCalledOnce()
    const [, keyframes] = animateMock.mock.calls[0]
    expect(keyframes).toMatchObject({ opacity: [0, 1] })
  })

  it('does not animate on mouseenter when gloss is disabled', async () => {
    const el = await mount(false)
    el.dispatchEvent(new MouseEvent('mouseenter'))
    expect(animateMock).not.toHaveBeenCalled()
  })

  it('ignores pointer input while disabled and reflects the attribute', async () => {
    const el = await mount()
    el.disabled = true
    await elementUpdated(el)
    expect(el.hasAttribute('disabled')).toBe(true)

    animateMock.mockClear()
    el.dispatchEvent(new MouseEvent('mousemove', { clientX: 0, clientY: 0 }))
    expect(animateMock).not.toHaveBeenCalled()
  })

  it('does nothing when reduced motion is preferred', async () => {
    stubReducedMotion(true)
    const el = await mount()
    el.dispatchEvent(new MouseEvent('mousemove', { clientX: 0, clientY: 0 }))
    expect(animateMock).not.toHaveBeenCalled()
  })
})
