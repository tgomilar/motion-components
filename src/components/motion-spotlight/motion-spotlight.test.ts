import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion } from '../../test/helpers.js'

// The fade in/out runs through Motion; the contract is *which* opacity target
// is handed to `animate` on each pointer/focus transition, so we mock it.
const { animateMock } = vi.hoisted(() => ({
  animateMock: vi.fn((..._args: unknown[]) => ({ stop: vi.fn() })),
}))
vi.mock('motion', () => ({ animate: animateMock }))

import type { MotionSpotlight } from './motion-spotlight.js'
import './motion-spotlight.js'

const spot = (el: MotionSpotlight) => el.shadowRoot!.querySelector<HTMLElement>('.spot')!

describe('motion-spotlight', () => {
  beforeEach(() => {
    stubReducedMotion(false)
    animateMock.mockClear()
  })

  async function mount() {
    return (await fixture(
      html`<motion-spotlight size="500"><div>content</div></motion-spotlight>`,
    )) as MotionSpotlight
  }

  it('renders a slot and an aria-hidden spotlight overlay', async () => {
    const el = await mount()
    expect(el.shadowRoot!.querySelector('slot')).not.toBeNull()
    expect(spot(el).getAttribute('aria-hidden')).toBe('true')
  })

  it('fades the overlay in on pointerenter', async () => {
    const el = await mount()
    el.dispatchEvent(new PointerEvent('pointerenter'))
    expect(animateMock).toHaveBeenCalledOnce()
    const [target, keyframes] = animateMock.mock.calls[0]
    expect(target).toBe(spot(el))
    expect(keyframes).toMatchObject({ opacity: [0, 1] })
  })

  it('fades the overlay out on pointerleave', async () => {
    const el = await mount()
    el.dispatchEvent(new PointerEvent('pointerenter'))
    animateMock.mockClear()
    el.dispatchEvent(new PointerEvent('pointerleave'))
    const [, keyframes] = animateMock.mock.calls[0]
    expect(keyframes).toMatchObject({ opacity: 0 })
  })

  it('fades in on keyboard focus (focusin)', async () => {
    const el = await mount()
    el.dispatchEvent(new FocusEvent('focusin'))
    expect(animateMock).toHaveBeenCalledOnce()
    expect(animateMock.mock.calls[0][1]).toMatchObject({ opacity: [0, 1] })
  })

  it('reflects size and color as attributes', async () => {
    const el = await mount()
    el.color = 'rgba(0,0,0,0.2)'
    await elementUpdated(el)
    expect(el.getAttribute('size')).toBe('500')
    expect(el.getAttribute('color')).toBe('rgba(0,0,0,0.2)')
  })

  it('does nothing on hover when reduced motion is preferred', async () => {
    stubReducedMotion(true)
    const el = await mount()
    el.dispatchEvent(new PointerEvent('pointerenter'))
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 10, clientY: 10 }))
    expect(animateMock).not.toHaveBeenCalled()
  })
})
