import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion } from '../../test/helpers.js'
import type { MotionCountdown } from './motion-countdown.js'
import './motion-countdown.js'

// A target far enough in the future that the settled digits are stable.
const FUTURE = '2999-12-31T23:59:59'

const digitText = (el: MotionCountdown) =>
  Array.from(el.shadowRoot!.querySelectorAll('.flip-digit'))
    .map((n) => n.textContent)
    .join('')

const NOW = new Date('2030-01-01T00:00:00Z')
const after = (ms: number) => new Date(NOW.getTime() + ms).toISOString()

describe('motion-countdown', () => {
  beforeEach(() => stubReducedMotion(false))
  afterEach(() => vi.useRealTimers())

  it('renders one unit block per format token with labels', async () => {
    const el = (await fixture(
      html`<motion-countdown to=${FUTURE} format="hours minutes seconds"></motion-countdown>`,
    )) as MotionCountdown
    await elementUpdated(el)
    expect(el.shadowRoot!.querySelectorAll('.unit')).toHaveLength(3)
    // labels default to true → Hours / Minutes / Seconds
    const labels = Array.from(el.shadowRoot!.querySelectorAll('.label')).map((n) => n.textContent)
    expect(labels).toEqual(['Hours', 'Minutes', 'Seconds'])
  })

  it('reflects to / format / roll attributes', async () => {
    const el = (await fixture(
      html`<motion-countdown to=${FUTURE} format="minutes seconds" roll></motion-countdown>`,
    )) as MotionCountdown
    await elementUpdated(el)
    expect(el.getAttribute('to')).toBe(FUTURE)
    expect(el.getAttribute('format')).toBe('minutes seconds')
    expect(el.roll).toBe(true)
    // roll mode renders reels instead of flip digits
    expect(el.shadowRoot!.querySelectorAll('.reel').length).toBeGreaterThan(0)
  })

  it('labels="false"-equivalent (labels=false) drops the label row', async () => {
    const el = (await fixture(
      html`<motion-countdown to=${FUTURE} format="seconds"></motion-countdown>`,
    )) as MotionCountdown
    el.labels = false
    await elementUpdated(el)
    expect(el.shadowRoot!.querySelectorAll('.label')).toHaveLength(0)
  })

  it('starts playing on connect and finish() zeroes every digit', async () => {
    const el = (await fixture(
      html`<motion-countdown to=${FUTURE} format="days hours minutes seconds"></motion-countdown>`,
    )) as MotionCountdown
    await elementUpdated(el)
    expect(el.playState).toBe('running')

    el.finish()
    await elementUpdated(el)
    expect(el.playState).toBe('finished')
    // four two-digit units all zeroed
    expect(digitText(el)).toBe('00000000')
  })

  it('renders a colon separator between units', async () => {
    const el = (await fixture(
      html`<motion-countdown to=${FUTURE} format="minutes seconds"></motion-countdown>`,
    )) as MotionCountdown
    await elementUpdated(el)
    const seps = el.shadowRoot!.querySelectorAll('.sep')
    expect(seps).toHaveLength(1)
    expect(seps[0].textContent).toBe(':')
  })

  it('an invalid / empty target settles to all zeros', async () => {
    const el = (await fixture(
      html`<motion-countdown format="seconds"></motion-countdown>`,
    )) as MotionCountdown
    await elementUpdated(el)
    expect(digitText(el)).toBe('00')
  })

  it('fires motion-finish once when the time runs out', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    vi.setSystemTime(NOW)
    const el = (await fixture(
      html`<motion-countdown to=${after(2000)} format="minutes seconds"></motion-countdown>`,
    )) as MotionCountdown
    let finishes = 0
    el.addEventListener('motion-finish', () => finishes++)

    await vi.advanceTimersByTimeAsync(1000)
    expect(finishes).toBe(0)
    expect(el.playState).toBe('running')

    await vi.advanceTimersByTimeAsync(5000)
    expect(finishes).toBe(1)
    expect(el.playState).toBe('finished')
  })

  it('counts down again when a new future target is set after it finished', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    vi.setSystemTime(NOW)
    const el = (await fixture(
      html`<motion-countdown to=${after(1000)} format="minutes seconds"></motion-countdown>`,
    )) as MotionCountdown
    await vi.advanceTimersByTimeAsync(2000)
    expect(el.playState).toBe('finished')
    let starts = 0
    el.addEventListener('motion-start', () => starts++)
    el.to = after(60000)
    await elementUpdated(el)
    expect(starts).toBe(1)
    expect(el.playState).toBe('running')
    await vi.advanceTimersByTimeAsync(1000)
    expect(digitText(el)).not.toBe('0000')
  })

  it('fires motion-finish when the time is up under reduced motion', async () => {
    stubReducedMotion(true)
    const el = document.createElement('motion-countdown')
    el.to = new Date(Date.now() - 1000).toISOString()
    let finishes = 0
    el.addEventListener('motion-finish', () => finishes++)
    document.body.append(el)
    await elementUpdated(el)
    expect(finishes).toBe(1)
    expect(el.playState).toBe('finished')
    el.remove()
  })

  it('finish() under reduced motion stops the timer', async () => {
    stubReducedMotion(true)
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const el = document.createElement('motion-countdown')
    el.to = new Date(Date.now() + 3_600_000).toISOString()
    document.body.append(el)
    await elementUpdated(el)
    el.finish()
    expect(vi.getTimerCount()).toBe(0)
    vi.useRealTimers()
    el.remove()
  })

  it('roll mode hides the digit columns and exposes each value as text', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    const el = (await fixture(
      html`<motion-countdown
        to=${after(330_500)}
        format="minutes seconds"
        roll
      ></motion-countdown>`,
    )) as MotionCountdown
    await elementUpdated(el)
    const values = [...el.shadowRoot!.querySelectorAll('.sr-only')].map((n) => n.textContent)
    expect(values).toEqual(['05', '30'])
    const strips = [...el.shadowRoot!.querySelectorAll('.strip')]
    expect(strips).toHaveLength(4)
    expect(strips.every((s) => s.closest('[aria-hidden="true"]'))).toBe(true)
  })

  it('roll mode keeps each digit in its window after the size changes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    stubReducedMotion(true)
    const el = (await fixture(
      html`<motion-countdown
        to=${after(330_500)}
        format="minutes seconds"
        roll
        style="--mc-countdown-size: 24px"
      ></motion-countdown>`,
    )) as MotionCountdown
    await elementUpdated(el)
    await new Promise((resolve) => setTimeout(resolve, 250))
    const shown = () =>
      [...el.shadowRoot!.querySelectorAll<HTMLElement>('.reel')].map((reel) => {
        const top = reel.getBoundingClientRect().top
        const digits = [...reel.querySelectorAll<HTMLElement>('.digit')]
        const hit = digits.find((d) => Math.abs(d.getBoundingClientRect().top - top) < 1)
        return hit?.textContent ?? '?'
      })
    expect(shown().join('')).toBe('0530')
    el.style.setProperty('--mc-countdown-size', '64px')
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(shown().join('')).toBe('0530')
  })
})
