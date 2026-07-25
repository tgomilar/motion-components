import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion, stubIntersectionObserver } from '../../test/helpers.js'
import type { IntersectionHandle } from '../../test/helpers.js'
import type { MotionCounter } from './motion-counter.js'
import './motion-counter.js'

const text = (el: MotionCounter) => el.shadowRoot?.textContent?.trim()

describe('motion-counter', () => {
  let io: IntersectionHandle

  beforeEach(() => {
    stubReducedMotion(false)
    io = stubIntersectionObserver()
  })

  it('renders the starting value before it animates', async () => {
    const el = (await fixture(
      html`<motion-counter from="5" to="99"></motion-counter>`,
    )) as MotionCounter
    expect(text(el)).toBe('5')
    expect(el.playState).toBe('idle')
  })

  it('formats with decimals, prefix and suffix at the final value', async () => {
    const el = (await fixture(
      html`<motion-counter to="42.5" decimals="1" prefix="$" suffix="%"></motion-counter>`,
    )) as MotionCounter
    el.finish()
    await elementUpdated(el)
    expect(text(el)).toBe('$42.5%')
  })

  it('starts counting when it scrolls into view', async () => {
    const el = (await fixture(html`<motion-counter to="100"></motion-counter>`)) as MotionCounter
    io.enter()
    expect(el.playState).toBe('running')
  })

  it('replay() resets to `from` and runs again', async () => {
    const el = (await fixture(
      html`<motion-counter from="0" to="100"></motion-counter>`,
    )) as MotionCounter
    el.finish()
    await elementUpdated(el)
    expect(text(el)).toBe('100')

    el.replay()
    expect(el.playState).toBe('running')
  })
})
