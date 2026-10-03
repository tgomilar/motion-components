import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion, waitForEvent } from '../../test/helpers.js'

// The slider snaps with Motion's spring; its *contract* is the index/event
// state it exposes, not interpolated frames. Mock `animate` so navigation
// resolves synchronously and we assert on the decision logic.
const { animateMock } = vi.hoisted(() => ({
  animateMock: vi.fn((..._args: unknown[]) => ({ stop: vi.fn() })),
}))
vi.mock('motion', () => ({ animate: animateMock }))

import type { MotionSlider } from './motion-slider.js'
import './motion-slider.js'

describe('motion-slider', () => {
  beforeEach(() => {
    stubReducedMotion(false)
    animateMock.mockClear()
  })

  async function mount() {
    return (await fixture(
      html`<motion-slider>
        <div>Slide 1</div>
        <div>Slide 2</div>
        <div>Slide 3</div>
      </motion-slider>`,
    )) as MotionSlider
  }

  it('builds a track wrapping the slides and adds nav affordances', async () => {
    const el = await mount()
    const track = el.querySelector<HTMLElement>('div[style*="flex"]')
    expect(track).not.toBeNull()
    expect(track!.children.length).toBe(3)
    // two arrow buttons for 3 slides
    expect(el.querySelectorAll('button[aria-label]').length).toBe(2)
  })

  it('goTo fires motion-change with the clamped index', async () => {
    const el = await mount()
    const changed = waitForEvent(el, 'motion-change')
    el.goTo(1)
    const ev = (await changed) as CustomEvent<{ index: number }>
    expect(ev.detail.index).toBe(1)
  })

  it('clamps navigation at the boundaries', async () => {
    const el = await mount()
    let last = -1
    el.addEventListener('motion-change', (e) => {
      last = (e as CustomEvent<{ index: number }>).detail.index
    })
    el.goTo(99)
    expect(last).toBe(2)
    el.goTo(-5)
    expect(last).toBe(0)
  })

  it('ArrowRight / ArrowLeft move the active slide', async () => {
    const el = await mount()
    const indices: number[] = []
    el.addEventListener('motion-change', (e) => {
      indices.push((e as CustomEvent<{ index: number }>).detail.index)
    })
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    expect(indices).toEqual([1, 2, 1])
  })

  it('drives the track with Motion when reduced motion is off', async () => {
    const el = await mount()
    animateMock.mockClear()
    el.goTo(1)
    expect(animateMock).toHaveBeenCalledOnce()
    const [target, keyframes] = animateMock.mock.calls[0]
    expect(target).toBe(el.querySelector('div[style*="flex"]'))
    expect(keyframes).toHaveProperty('x')
  })

  it('under reduced motion, snaps without calling animate', async () => {
    stubReducedMotion(true)
    const el = await mount()
    animateMock.mockClear()
    el.goTo(2)
    expect(animateMock).not.toHaveBeenCalled()
    const track = el.querySelector<HTMLElement>('div[style*="flex"]')
    expect(track!.style.transform).toContain('translateX(')
  })

  it('is keyboard-focusable via tabindex', async () => {
    const el = await mount()
    await elementUpdated(el)
    expect(el.tabIndex).toBe(0)
  })
})
