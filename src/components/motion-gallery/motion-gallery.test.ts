import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion } from '../../test/helpers.js'

// Gallery (and the motion-hover/motion-stagger it composes) animate the
// lightbox through Motion. We mock `animate` so the FLIP clone work resolves
// synchronously and assert on the ARIA/structure/index contract instead.
const { animateMock } = vi.hoisted(() => ({
  animateMock: vi.fn((..._args: unknown[]) => {
    const p: Promise<void> & { stop: () => void } = Object.assign(Promise.resolve(), {
      stop: vi.fn(),
    })
    return p
  }),
}))
// motion-stagger (composed by the gallery) also imports `stagger`.
vi.mock('motion', () => ({ animate: animateMock, stagger: vi.fn(() => 0) }))

import type { MotionGallery } from './motion-gallery.js'
import './motion-gallery.js'

const items = (el: MotionGallery) => Array.from(el.querySelectorAll('[role="button"]'))
const lightbox = () => document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]')

describe('motion-gallery', () => {
  beforeEach(() => {
    stubReducedMotion(false)
    animateMock.mockClear()
    document.querySelectorAll('[role="dialog"][aria-modal="true"]').forEach((n) => n.remove())
  })

  async function mount() {
    return (await fixture(
      html`<motion-gallery columns="3">
        <img src="a.png" alt="A" data-caption="First" />
        <img src="b.png" alt="B" data-caption="Second" />
        <img src="c.png" alt="C" />
      </motion-gallery>`,
    )) as MotionGallery
  }

  it('exposes the gallery role and marks each item as an openable button', async () => {
    const el = await mount()
    expect(el.getAttribute('role')).toBe('group')
    const btns = items(el)
    expect(btns).toHaveLength(3)
    for (const b of btns) {
      expect(b.getAttribute('aria-haspopup')).toBe('dialog')
      expect(b.getAttribute('tabindex')).toBe('0')
    }
  })

  it('derives the aria-label from data-caption or a positional fallback', async () => {
    const el = await mount()
    const btns = items(el)
    expect(btns[0].getAttribute('aria-label')).toBe('First')
    expect(btns[2].getAttribute('aria-label')).toBe('Open item 3 of 3')
  })

  it('clicking an item opens the modal lightbox with a live counter', async () => {
    const el = await mount()
    items(el)[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await elementUpdated(el)
    const box = lightbox()
    expect(box).not.toBeNull()
    expect(box!.style.display).toBe('block')
    expect(box!.textContent).toContain('1 / 3')
  })

  it('next() advances the counter and caption', async () => {
    const el = await mount()
    items(el)[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await elementUpdated(el)
    const next = lightbox()!.querySelector<HTMLButtonElement>('button[aria-label="Next item"]')!
    next.click()
    expect(lightbox()!.textContent).toContain('2 / 3')
  })

  it('disables prev at the first item and next at the last', async () => {
    const el = await mount()
    items(el)[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await elementUpdated(el)
    const box = lightbox()!
    const prev = box.querySelector<HTMLButtonElement>('button[aria-label="Previous item"]')!
    const next = box.querySelector<HTMLButtonElement>('button[aria-label="Next item"]')!
    expect(prev.disabled).toBe(true)
    expect(prev.getAttribute('aria-disabled')).toBe('true')
    expect(next.disabled).toBe(false)
    next.click()
    next.click()
    expect(next.disabled).toBe(true)
  })

  it('Escape collapses the lightbox back to the grid', async () => {
    const el = await mount()
    items(el)[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await elementUpdated(el)
    expect(lightbox()!.style.display).toBe('block')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await elementUpdated(el)
    expect(lightbox()!.style.display).toBe('none')
  })
})
