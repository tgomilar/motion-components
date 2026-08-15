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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Long enough for the rate ramp to bottom out, so a resume happens from a
 * fully stopped ticker rather than from one still coasting near full speed.
 */
const HOVER_DWELL = 900

/** Track offset in px — negative and decreasing while scrolling left. */
const trackX = (el: MotionTicker) => {
  const track = el.querySelector('div')
  if (!track) throw new Error('ticker has no track')
  return new DOMMatrix(getComputedStyle(track).transform).m41
}

/** Poll until `predicate` holds, so tests never depend on a fixed ramp length. */
async function until(predicate: () => boolean, timeout = 3000) {
  const deadline = performance.now() + timeout
  while (!predicate()) {
    if (performance.now() > deadline) throw new Error('timed out waiting for condition')
    await sleep(16)
  }
}

/** A ticker that has been scrolling long enough to be well away from x: 0. */
async function scrollingTicker() {
  const el = await ticker()
  await until(() => trackX(el) < -20)
  return el
}

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

  it('keeps scrolling while it decelerates on hover', async () => {
    const el = await scrollingTicker()
    const atHover = trackX(el)
    el.dispatchEvent(new MouseEvent('mouseenter'))
    await sleep(80)
    expect(trackX(el)).toBeLessThan(atHover)
  })

  it('holds its position for as long as the pointer stays', async () => {
    const el = await scrollingTicker()
    el.dispatchEvent(new MouseEvent('mouseenter'))
    await sleep(HOVER_DWELL)
    expect(el.playState).toBe('paused')
    const stopped = trackX(el)
    await sleep(120)
    expect(trackX(el)).toBe(stopped)
  })

  it('resumes from where it stopped when the pointer leaves', async () => {
    const el = await scrollingTicker()
    el.dispatchEvent(new MouseEvent('mouseenter'))
    await sleep(HOVER_DWELL)
    const stopped = trackX(el)

    el.dispatchEvent(new MouseEvent('mouseleave'))
    await sleep(120)

    expect(el.playState).toBe('running')
    expect(trackX(el)).toBeLessThanOrEqual(stopped)
    expect(trackX(el)).toBeGreaterThan(stopped - 20)
  })

  it('decelerates and resumes in place when toggled by keyboard', async () => {
    const el = await scrollingTicker()
    const atPress = trackX(el)
    el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    await sleep(80)
    expect(trackX(el)).toBeLessThan(atPress)

    await sleep(HOVER_DWELL)
    const stopped = trackX(el)
    el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    await sleep(120)

    expect(el.playState).toBe('running')
    expect(trackX(el)).toBeLessThanOrEqual(stopped)
    expect(trackX(el)).toBeGreaterThan(stopped - 20)
  })

  it('stays parked in place when a live attribute changes while hover-paused', async () => {
    const el = await scrollingTicker()
    el.dispatchEvent(new MouseEvent('mouseenter'))
    await sleep(HOVER_DWELL)
    expect(el.playState).toBe('paused')
    const stopped = trackX(el)

    el.setAttribute('speed', '30')
    await sleep(120)

    expect(el.playState).toBe('paused')
    const parked = trackX(el)
    expect(Math.abs(parked - stopped)).toBeLessThan(2)
    await sleep(120)
    expect(trackX(el)).toBe(parked)

    el.dispatchEvent(new MouseEvent('mouseleave'))
    await sleep(120)

    expect(el.playState).toBe('running')
    expect(trackX(el)).toBeLessThanOrEqual(parked)
    expect(trackX(el)).toBeGreaterThan(parked - 20)
  })

  it('scrolls on without a jump across a live attribute change while running', async () => {
    const el = await scrollingTicker()
    const atChange = trackX(el)
    el.setAttribute('speed', '30')
    await sleep(120)
    expect(el.playState).toBe('running')
    expect(trackX(el)).toBeLessThan(atChange)
    expect(trackX(el)).toBeGreaterThan(atChange - 20)
  })

  it('keeps its rendered position when direction flips', async () => {
    const el = await scrollingTicker()
    el.dispatchEvent(new MouseEvent('mouseenter'))
    await sleep(HOVER_DWELL)
    expect(el.playState).toBe('paused')
    const stopped = trackX(el)

    el.setAttribute('direction', 'right')
    await sleep(120)

    expect(el.playState).toBe('paused')
    expect(Math.abs(trackX(el) - stopped)).toBeLessThan(2)
  })

  it('keeps a keyboard pause across a pointer visit', async () => {
    const el = await scrollingTicker()
    el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    await sleep(HOVER_DWELL)
    expect(el.playState).toBe('paused')
    const stopped = trackX(el)

    el.dispatchEvent(new MouseEvent('mouseenter'))
    await sleep(80)
    el.dispatchEvent(new MouseEvent('mouseleave'))
    await sleep(200)

    expect(el.playState).toBe('paused')
    expect(trackX(el)).toBe(stopped)

    el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    await sleep(120)
    expect(el.playState).toBe('running')
  })

  it('tops the track back up when the container grows', async () => {
    const el = await scrollingTicker()
    const setA = el.querySelector('div > div') as HTMLElement
    const grownTo = setA.offsetWidth + 200
    el.style.width = `${grownTo}px`
    await until(() => setA.offsetWidth >= grownTo)
  })

  it('re-times the wave when speed changes', async () => {
    const el = (await fixture(
      html`<motion-ticker style="width: 200px" wave wave-length="300" speed="30"
        ><span>One</span><span>Two</span><span>Three</span></motion-ticker
      >`,
    )) as MotionTicker
    await until(() => trackX(el) < -5)

    // Wave period is wave-length / speed: 10s before, 0.5s after. Total
    // vertical travel over ~1.1s tells the two apart with a wide margin.
    el.setAttribute('speed', '600')
    const item = el.querySelector('div > div > span') as HTMLElement
    const y = () => new DOMMatrix(getComputedStyle(item).transform).m42
    let travel = 0
    let last = y()
    for (let i = 0; i < 14; i++) {
      await sleep(80)
      const cur = y()
      travel += Math.abs(cur - last)
      last = cur
    }
    expect(travel).toBeGreaterThan(25)
  })

  it('re-applies the gap to the track when the attribute changes', async () => {
    const el = await scrollingTicker()
    const setA = el.querySelector('div > div') as HTMLElement
    const setB = setA.nextElementSibling as HTMLElement
    expect(getComputedStyle(setA).columnGap).toBe('32px')

    el.setAttribute('gap', '64')

    expect(getComputedStyle(setA).columnGap).toBe('64px')
    expect(getComputedStyle(setA).marginRight).toBe('64px')
    expect(getComputedStyle(setB).columnGap).toBe('64px')
  })

  it('does not pause on hover when pause-on-hover is false', async () => {
    const el = (await fixture(
      html`<motion-ticker style="width: 200px" pause-on-hover="false"
        ><span>One</span><span>Two</span><span>Three</span></motion-ticker
      >`,
    )) as MotionTicker
    await until(() => trackX(el) < -20)
    el.dispatchEvent(new MouseEvent('mouseenter'))
    await sleep(120)
    expect(el.playState).toBe('running')
  })
})
