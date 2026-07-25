import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion } from '../../test/helpers.js'

// Press drives Motion's spring directly on pointer input; its *contract* is
// which values it hands to `animate` and when, so we mock `animate` and assert
// on the decision logic rather than interpolated frames.
const { animateMock } = vi.hoisted(() => ({ animateMock: vi.fn() }))
vi.mock('motion', () => ({ animate: animateMock }))

import type { MotionPress } from './motion-press.js'
import './motion-press.js'

describe('motion-press', () => {
  beforeEach(() => {
    stubReducedMotion(false)
    animateMock.mockClear()
  })

  async function mount() {
    return (await fixture(
      html`<motion-press scale="0.9" duration="0.2"><button>Press</button></motion-press>`,
    )) as MotionPress
  }

  it('scales down on pointerdown', async () => {
    const el = await mount()
    el.dispatchEvent(new PointerEvent('pointerdown'))
    expect(animateMock).toHaveBeenCalledOnce()
    const [target, keyframes, options] = animateMock.mock.calls[0]
    expect(target).toBe(el)
    expect(keyframes).toMatchObject({ scale: 0.9 })
    expect(options).toMatchObject({ type: 'spring', bounce: 0, duration: 0.2 })
  })

  it('settles back to rest on pointerup', async () => {
    const el = await mount()
    el.dispatchEvent(new PointerEvent('pointerdown'))
    animateMock.mockClear()
    el.dispatchEvent(new PointerEvent('pointerup'))
    expect(animateMock).toHaveBeenCalledOnce()
    const [, keyframes, options] = animateMock.mock.calls[0]
    expect(keyframes).toMatchObject({ scale: 1 })
    expect(options).toMatchObject({ type: 'spring', bounce: 0.4 })
  })

  it('settles back to rest on pointerleave', async () => {
    const el = await mount()
    el.dispatchEvent(new PointerEvent('pointerdown'))
    animateMock.mockClear()
    el.dispatchEvent(new PointerEvent('pointerleave'))
    const [, keyframes] = animateMock.mock.calls[0]
    expect(keyframes).toMatchObject({ scale: 1 })
  })

  it('ignores pointer input while disabled and reflects the attribute', async () => {
    const el = await mount()
    el.disabled = true
    await elementUpdated(el)
    expect(el.hasAttribute('disabled')).toBe(true)

    animateMock.mockClear()
    el.dispatchEvent(new PointerEvent('pointerdown'))
    expect(animateMock).not.toHaveBeenCalled()
  })

  it('does nothing when reduced motion is preferred', async () => {
    stubReducedMotion(true)
    const el = await mount()
    el.dispatchEvent(new PointerEvent('pointerdown'))
    expect(animateMock).not.toHaveBeenCalled()
  })

  it('settles to rest when disabled while pressed', async () => {
    const el = await mount()
    el.dispatchEvent(new PointerEvent('pointerdown'))
    animateMock.mockClear()
    el.disabled = true
    await elementUpdated(el)
    expect(animateMock).toHaveBeenCalledOnce()
    const [, keyframes] = animateMock.mock.calls[0]
    expect(keyframes).toMatchObject({ scale: 1 })
  })
})
