import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion } from '../../test/helpers.js'
import type { MotionTicker } from './motion-ticker.js'
import './motion-ticker.js'

const ticker = (extra = '') =>
  fixture(
    html`<motion-ticker style="width: 200px" ${extra}
      ><span>One</span><span>Two</span><span>Three</span></motion-ticker
    >`,
  ) as Promise<MotionTicker>

describe('motion-ticker', () => {
  beforeEach(() => {
    stubReducedMotion(false)
  })

  it('applies accessibility affordances on connect', async () => {
    const el = await ticker()
    expect(el.getAttribute('role')).toBe('region')
    expect(el.getAttribute('tabindex')).toBe('0')
    expect(el.getAttribute('aria-label')).toContain('Space to pause')
  })

  it('keeps the original item text in the DOM', async () => {
    const el = await ticker()
    expect(el.textContent).toContain('One')
    expect(el.textContent).toContain('Two')
    expect(el.textContent).toContain('Three')
  })

  it('reflects the direction attribute it was given', async () => {
    const el = (await fixture(
      html`<motion-ticker direction="right"><span>One</span></motion-ticker>`,
    )) as MotionTicker
    expect(el.getAttribute('direction')).toBe('right')
  })

  it('reduced motion skips building the duplicated track', async () => {
    stubReducedMotion(true)
    const el = (await fixture(
      html`<motion-ticker><span data-x>Only</span></motion-ticker>`,
    )) as MotionTicker
    await elementUpdated(el)
    // No track wrapper is inserted; the original child stays as a direct child.
    expect(el.querySelector('[data-x]')?.parentElement).toBe(el)
    expect(el.playState).toBe('idle')
  })

  it('cancel() drops back to idle', async () => {
    const el = await ticker()
    el.cancel()
    expect(el.playState).toBe('idle')
  })

  it('finish() settles playback to finished', async () => {
    const el = await ticker()
    el.finish()
    expect(el.playState).toBe('finished')
  })
})
