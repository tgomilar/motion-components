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

  it('reacts when trigger changes after the first render', async () => {
    const el = await mount('hover')
    await elementUpdated(el)

    el.trigger = 'click'
    await elementUpdated(el)
    expect(el.getAttribute('role')).toBe('button')
    expect(el.tabIndex).toBe(0)
    el.dispatchEvent(new PointerEvent('pointerenter'))
    expect(animateMock).not.toHaveBeenCalled()
    el.dispatchEvent(new MouseEvent('click'))
    expect(animateMock.mock.calls[0][1]).toMatchObject({ rotateY: 180 })

    animateMock.mockClear()
    el.trigger = 'hover'
    await elementUpdated(el)
    expect(el.hasAttribute('role')).toBe(false)
    expect(el.hasAttribute('tabindex')).toBe(false)
    el.dispatchEvent(new MouseEvent('click'))
    expect(animateMock).not.toHaveBeenCalled()
    el.dispatchEvent(new PointerEvent('pointerleave'))
    expect(animateMock.mock.calls[0][1]).toMatchObject({ rotateY: 0 })
  })

  it('does not mark the faces as a live region', async () => {
    const el = await mount('click')
    await elementUpdated(el)
    expect(el.shadowRoot!.querySelector('[aria-live]')).toBeNull()
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

  it('reflects flipped, reports it with aria-pressed and fires motion-change on interaction', async () => {
    const el = await mount('click')
    await elementUpdated(el)
    const details: boolean[] = []
    el.addEventListener('motion-change', (e) =>
      details.push((e as CustomEvent<{ flipped: boolean }>).detail.flipped),
    )
    expect(el.getAttribute('aria-pressed')).toBe('false')
    el.dispatchEvent(new MouseEvent('click'))
    await elementUpdated(el)
    expect(el.flipped).toBe(true)
    expect(el.hasAttribute('flipped')).toBe(true)
    expect(el.getAttribute('aria-pressed')).toBe('true')
    el.flip()
    expect(details).toEqual([true, false])
  })

  it('turns to the face set with the flipped property, without an event', async () => {
    const el = await mount('click')
    await elementUpdated(el)
    const onChange = vi.fn()
    el.addEventListener('motion-change', onChange)
    el.flipped = true
    await elementUpdated(el)
    expect(animateMock.mock.calls[0][1]).toMatchObject({ rotateY: 180 })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('starts on the back with the flipped attribute', async () => {
    const el = (await fixture(
      html`<motion-flip-card flipped
        ><div slot="front">F</div><div slot="back">B</div></motion-flip-card
      >`,
    )) as MotionFlipCard
    await elementUpdated(el)
    expect(scene(el).style.transform).toBe('rotateY(180deg)')
    expect(animateMock).not.toHaveBeenCalled()
  })
})
