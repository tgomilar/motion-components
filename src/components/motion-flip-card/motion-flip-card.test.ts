import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion } from '../../test/helpers.js'

// The flip runs through Motion's spring; the contract is the rotation target
// and axis handed to `animate`, so we mock it rather than assert frames.
const { animateMock } = vi.hoisted(() => ({
  animateMock: vi.fn((..._args: unknown[]) => ({ stop: vi.fn() })),
}))
vi.mock('motion', () => ({ animate: animateMock }))

import type { MotionFlipCard } from './motion-flip-card.js'
import './motion-flip-card.js'

const scene = (el: MotionFlipCard) => el.shadowRoot!.querySelector<HTMLElement>('.scene')!

describe('motion-flip-card', () => {
  beforeEach(() => {
    stubReducedMotion(false)
    animateMock.mockClear()
  })

  async function mount(trigger = 'hover', axis = 'y') {
    return (await fixture(
      html`<motion-flip-card trigger=${trigger} axis=${axis}>
        <div slot="front">Front</div>
        <div slot="back">Back</div>
      </motion-flip-card>`,
    )) as MotionFlipCard
  }

  it('renders front and back faces and applies a perspective on the host', async () => {
    const el = await mount()
    await elementUpdated(el)
    expect(el.shadowRoot!.querySelector('slot[name="front"]')).not.toBeNull()
    expect(el.shadowRoot!.querySelector('slot[name="back"]')).not.toBeNull()
    expect(el.style.perspective).toBe('1000px')
  })

  it('hover trigger flips to 180deg on pointerenter and back on pointerleave', async () => {
    const el = await mount('hover')
    await elementUpdated(el)
    el.dispatchEvent(new PointerEvent('pointerenter'))
    expect(animateMock).toHaveBeenCalledOnce()
    const [target, keyframes] = animateMock.mock.calls[0]
    expect(target).toBe(scene(el))
    expect(keyframes).toMatchObject({ rotateY: 180 })

    animateMock.mockClear()
    el.dispatchEvent(new PointerEvent('pointerleave'))
    expect(animateMock.mock.calls[0][1]).toMatchObject({ rotateY: 0 })
  })

  it('axis="x" rotates around the horizontal axis', async () => {
    const el = await mount('hover', 'x')
    await elementUpdated(el)
    expect(el.getAttribute('axis')).toBe('x')
    el.dispatchEvent(new PointerEvent('pointerenter'))
    expect(animateMock.mock.calls[0][1]).toMatchObject({ rotateX: 180 })
  })

  it('click trigger sets button semantics and toggles on click', async () => {
    const el = await mount('click')
    await elementUpdated(el)
    expect(el.getAttribute('role')).toBe('button')
    expect(el.tabIndex).toBe(0)

    el.dispatchEvent(new MouseEvent('click'))
    expect(animateMock.mock.calls[0][1]).toMatchObject({ rotateY: 180 })
    animateMock.mockClear()
    el.dispatchEvent(new MouseEvent('click'))
    expect(animateMock.mock.calls[0][1]).toMatchObject({ rotateY: 0 })
  })

  it('flip() toggles programmatically', async () => {
    const el = await mount('click')
    await elementUpdated(el)
    el.flip()
    expect(animateMock).toHaveBeenCalledOnce()
    expect(animateMock.mock.calls[0][1]).toMatchObject({ rotateY: 180 })
  })

  it('reduced motion sets the final transform without animating', async () => {
    stubReducedMotion(true)
    const el = await mount('hover')
    await elementUpdated(el)
    el.dispatchEvent(new PointerEvent('pointerenter'))
    expect(animateMock).not.toHaveBeenCalled()
    expect(scene(el).style.transform).toBe('rotateY(180deg)')
  })
})
