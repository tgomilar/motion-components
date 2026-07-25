import { describe, it, expect, beforeEach } from 'vitest'
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

describe('motion-countdown', () => {
  beforeEach(() => stubReducedMotion(false))

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
})
