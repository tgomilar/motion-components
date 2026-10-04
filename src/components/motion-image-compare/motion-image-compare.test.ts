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
})
