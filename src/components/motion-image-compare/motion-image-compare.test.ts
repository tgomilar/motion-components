import { describe, it, expect, beforeEach } from 'vitest'
import { page } from 'vitest/browser'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion } from '../../test/helpers.js'
import type { MotionImageCompare } from './motion-image-compare.js'
import './motion-image-compare.js'

const knob = (el: MotionImageCompare) => el.shadowRoot!.querySelector<HTMLElement>('.knob')!
const after = (el: MotionImageCompare) => el.shadowRoot!.querySelector<HTMLElement>('.after')!
const handle = (el: MotionImageCompare) => el.shadowRoot!.querySelector<HTMLElement>('.handle')!

describe('motion-image-compare', () => {
  beforeEach(() => stubReducedMotion(false))

  async function mount() {
    return (await fixture(
      html`<motion-image-compare start="50">
        <img slot="before" src="a.png" alt="before" />
        <img slot="after" src="b.png" alt="after" />
      </motion-image-compare>`,
    )) as MotionImageCompare
  }

  it('follows the pointer while dragging instead of springing back to the press point', async () => {
    const el = await mount()
    el.style.width = '400px'
    el.style.height = '200px'
    await elementUpdated(el)
    const r = el.getBoundingClientRect()
    const at = (f: number) => ({
      clientX: r.left + r.width * f,
      clientY: r.top + r.height / 2,
      pointerId: 1,
      button: 0,
      bubbles: true,
    })
    el.dispatchEvent(new PointerEvent('pointerdown', at(0.2)))
    for (let pct = 25; pct <= 80; pct += 5)
      el.dispatchEvent(new PointerEvent('pointermove', at(pct / 100)))
    await new Promise((resolve) => setTimeout(resolve, 600))
    expect(el['pos']).toBeCloseTo(80, 0)
    el.dispatchEvent(new PointerEvent('pointerup', at(0.8)))
    el.dispatchEvent(new PointerEvent('pointermove', at(0.3)))
    expect(el['pos']).toBeCloseTo(80, 0)
  })

  it('stops dragging when the pointer is cancelled', async () => {
    const el = await mount()
    el.style.width = '400px'
    el.style.height = '200px'
    await elementUpdated(el)
    const r = el.getBoundingClientRect()
    const at = (f: number) => ({
      clientX: r.left + r.width * f,
      clientY: r.top + r.height / 2,
      pointerId: 1,
      button: 0,
      bubbles: true,
    })
    stubReducedMotion(true)
    el.dispatchEvent(new PointerEvent('pointerdown', at(0.6)))
    el.dispatchEvent(new PointerEvent('pointercancel', at(0.6)))
    el.dispatchEvent(new PointerEvent('pointermove', at(0.1)))
    expect(el['pos']).toBeCloseTo(60, 0)
  })

  it('exposes an ARIA slider on the knob reflecting the split position', async () => {
    const el = await mount()
    await elementUpdated(el)
    const k = knob(el)
    expect(k.getAttribute('role')).toBe('slider')
    expect(k.getAttribute('aria-valuemin')).toBe('0')
    expect(k.getAttribute('aria-valuemax')).toBe('100')
    expect(k.getAttribute('aria-valuenow')).toBe('50')
    expect(k.getAttribute('aria-orientation')).toBe('horizontal')
    expect(k.tabIndex).toBe(0)
  })

  it('exposes the knob to screen readers as a named slider without the glyph', async () => {
    const el = await mount()
    await elementUpdated(el)
    const k = knob(el)
    const named = page.getByRole('slider', { name: 'Image comparison' }).elements()
    expect(named).toContain(k)
    expect(k.querySelector('[aria-hidden="true"]')!.textContent).toBe('⇆')
  })

  it('applies the initial split to the after-pane clip and handle', async () => {
    const el = await mount()
    await elementUpdated(el)
    // browsers normalise the shorthand to `inset(0px 0px 0px 50%)`
    expect(after(el).style.clipPath).toContain('50%')
    expect(after(el).style.clipPath.startsWith('inset(')).toBe(true)
    expect(handle(el).style.left).toBe('50%')
  })

  it('reflects start and orientation attributes', async () => {
    const el = (await fixture(
      html`<motion-image-compare start="30" orientation="vertical">
        <img slot="before" src="a.png" alt="before" />
        <img slot="after" src="b.png" alt="after" />
      </motion-image-compare>`,
    )) as MotionImageCompare
    await elementUpdated(el)
    expect(el.getAttribute('orientation')).toBe('vertical')
    expect(knob(el).getAttribute('aria-orientation')).toBe('vertical')
    // vertical clips from the top — browser normalises to `inset(30% 0px 0px)`
    expect(after(el).style.clipPath.startsWith('inset(30%')).toBe(true)
  })

  it('arrow keys nudge the split (reduced motion applies synchronously)', async () => {
    stubReducedMotion(true)
    const el = await mount()
    await elementUpdated(el)
    knob(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await elementUpdated(el)
    expect(knob(el).getAttribute('aria-valuenow')).toBe('52')
    knob(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    await elementUpdated(el)
    expect(knob(el).getAttribute('aria-valuenow')).toBe('50')
  })

  it('quick arrow presses step from where the split is heading', async () => {
    stubReducedMotion(false)
    const el = await mount()
    await elementUpdated(el)
    const positions: number[] = []
    el.addEventListener('motion-change', (e) =>
      positions.push((e as CustomEvent<{ position: number }>).detail.position),
    )
    knob(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    knob(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(positions).toEqual([52, 54])
    expect(el.position).toBe(54)
  })

  it('Shift+Arrow takes a larger step', async () => {
    stubReducedMotion(true)
    const el = await mount()
    await elementUpdated(el)
    knob(el).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }),
    )
    await elementUpdated(el)
    expect(knob(el).getAttribute('aria-valuenow')).toBe('60')
  })

  it('Home and End move the split to 0 and 100', async () => {
    stubReducedMotion(true)
    const el = await mount()
    await elementUpdated(el)
    knob(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    await elementUpdated(el)
    expect(knob(el).getAttribute('aria-valuenow')).toBe('100')
    knob(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    await elementUpdated(el)
    expect(knob(el).getAttribute('aria-valuenow')).toBe('0')
  })

  it('clamps the split within 0–100 at the edge', async () => {
    stubReducedMotion(true)
    const el = (await fixture(
      html`<motion-image-compare start="98">
        <img slot="before" src="a.png" alt="before" />
        <img slot="after" src="b.png" alt="after" />
      </motion-image-compare>`,
    )) as MotionImageCompare
    await elementUpdated(el)
    knob(el).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }),
    )
    await elementUpdated(el)
    expect(knob(el).getAttribute('aria-valuenow')).toBe('100')
  })

  it('blocks text and image selection while dragging, WebKit included', async () => {
    const el = await mount()
    await elementUpdated(el)
    const style = getComputedStyle(el) as CSSStyleDeclaration & { webkitUserSelect?: string }
    expect(style.userSelect).toBe('none')
    expect(style.webkitUserSelect ?? 'none').toBe('none')
  })

  it('position springs the split without an event; keys fire motion-change', async () => {
    stubReducedMotion(true)
    const el = await mount()
    await elementUpdated(el)
    const positions: number[] = []
    el.addEventListener('motion-change', (e) =>
      positions.push((e as CustomEvent<{ position: number }>).detail.position),
    )
    el.position = 130
    expect(el.position).toBe(100)
    expect(after(el).style.clipPath).toBe('inset(0px 0px 0px 100%)')
    knob(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    expect(el.position).toBe(0)
    expect(positions).toEqual([0])
  })

  it('position set before the first render becomes the starting split', async () => {
    const el = document.createElement('motion-image-compare') as MotionImageCompare
    expect(() => (el.position = 20)).not.toThrow()
    expect(el.position).toBe(20)
    el.innerHTML = '<img slot="before" alt="" /><img slot="after" alt="" />'
    document.body.append(el)
    await elementUpdated(el)
    expect(el.position).toBe(20)
    expect(after(el).style.clipPath).toBe('inset(0px 0px 0px 20%)')
    el.remove()
  })

  it('position reads the target at once while the split springs there', async () => {
    const el = await mount()
    await elementUpdated(el)
    el.position = 20
    expect(el.position).toBe(20)
  })

  it('does not fire motion-change when a key would not move the split', async () => {
    stubReducedMotion(true)
    const el = await mount()
    await elementUpdated(el)
    let changes = 0
    el.addEventListener('motion-change', () => changes++)
    knob(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    knob(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    expect(changes).toBe(1)
  })
})
