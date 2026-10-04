import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion } from '../../test/helpers.js'
import type * as Motion from 'motion'

// The fade in/out runs through Motion; the contract is *which* opacity target
// is handed to `animate` on each pointer/focus transition, so we mock it.
const { animateMock } = vi.hoisted(() => ({
  animateMock: vi.fn((..._args: unknown[]) => ({ stop: vi.fn() })),
}))
vi.mock('motion', async (importOriginal) => ({
  ...(await importOriginal<typeof Motion>()),
  animate: animateMock,
}))

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

  async function mountSized() {
    return (await fixture(
      html`<motion-spotlight style="width:200px"
        ><div style="height:100px">content</div></motion-spotlight
      >`,
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
    expect(keyframes).toMatchObject({ opacity: 1 })
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
    expect(animateMock.mock.calls[0][1]).toMatchObject({ opacity: 1 })
  })

  it('draws the glow at the center on focus before the pointer has moved', async () => {
    const el = await mountSized()
    el.dispatchEvent(new FocusEvent('focusin'))
    expect(spot(el).style.background).toContain('circle at 100px 50px')
  })

  it('keeps the pointer position when content takes focus', async () => {
    const el = await mountSized()
    const r = el.getBoundingClientRect()
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + 30, clientY: r.top + 20 }))
    el.dispatchEvent(new FocusEvent('focusin'))
    expect(spot(el).style.background).toContain('circle at 30px 20px')
  })

  it('reflects size and reads the color from --spotlight-color', async () => {
    const el = await mount()
    await elementUpdated(el)
    expect(el.getAttribute('size')).toBe('500')
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 10, clientY: 10 }))
    const spot = el.shadowRoot!.querySelector<HTMLElement>('.spot')!
    expect(spot.style.background).toContain('var(--spotlight-color')
  })

  it('follows the pointer with a spring after the first move', async () => {
    const el = await mount()
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 10, clientY: 10 }))
    expect(animateMock).not.toHaveBeenCalled()
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 80, clientY: 40 }))
    expect(animateMock).toHaveBeenCalledTimes(2)
    expect(animateMock.mock.calls[0][2]).toMatchObject({
      type: 'spring',
      duration: 0.35,
      bounce: 0,
    })
  })

  it('does nothing on hover when reduced motion is preferred', async () => {
    stubReducedMotion(true)
    const el = await mount()
    el.dispatchEvent(new PointerEvent('pointerenter'))
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 10, clientY: 10 }))
    expect(animateMock).not.toHaveBeenCalled()
  })
})
