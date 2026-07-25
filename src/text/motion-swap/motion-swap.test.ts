import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion, stubIntersectionObserver } from '../../test/helpers.js'
import type { IntersectionHandle } from '../../test/helpers.js'
import type { MotionSwap } from './motion-swap.js'
import './motion-swap.js'

// Char pairs are split into the light DOM; each original char is rendered once
// as the `original` span, so the visible text is the trimmed light-DOM content.
const text = (el: MotionSwap) => el.textContent?.replace(/\s+/g, ' ').trim()

describe('motion-swap', () => {
  let io: IntersectionHandle

  beforeEach(() => {
    stubReducedMotion(false)
    io = stubIntersectionObserver()
  })

  it('splits text into per-character pairs and becomes ready', async () => {
    const el = (await fixture(html`<motion-swap>Hello</motion-swap>`)) as MotionSwap
    await elementUpdated(el)
    expect(el.hasAttribute('data-ready')).toBe(true)
    // Each visible character appears twice (original + duplicate) in the light DOM.
    expect(el.textContent).toContain('H')
    expect(el.textContent).toContain('o')
  })

  it('preserves word spacing across a multi-word phrase', async () => {
    const el = (await fixture(
      html`<motion-swap trigger="reveal">Hi there</motion-swap>`,
    )) as MotionSwap
    await elementUpdated(el)
    // Each char is doubled (original + duplicate span); the inter-word space is
    // kept as its own span, so the two words stay separated.
    expect(text(el)).toBe('HHii tthheerree')
  })

  it('starts on viewport entry in reveal mode', async () => {
    const el = (await fixture(
      html`<motion-swap trigger="reveal">Hello</motion-swap>`,
    )) as MotionSwap
    await elementUpdated(el)
    expect(el.playState).toBe('idle')
    io.enter()
    expect(el.playState).toBe('running')
  })

  it('does not observe the viewport in hover mode', async () => {
    const el = (await fixture(html`<motion-swap trigger="hover">Hello</motion-swap>`)) as MotionSwap
    await elementUpdated(el)
    io.enter()
    expect(el.playState).toBe('idle')
  })

  it('finish() drives playback to finished', async () => {
    const el = (await fixture(
      html`<motion-swap trigger="reveal">Hello</motion-swap>`,
    )) as MotionSwap
    await elementUpdated(el)
    io.enter()
    el.finish()
    expect(el.playState).toBe('finished')
    await expect(el.finished).resolves.toBeUndefined()
  })

  it('reflects the reverse property to an attribute', async () => {
    const el = (await fixture(html`<motion-swap>Hello</motion-swap>`)) as MotionSwap
    await elementUpdated(el)
    // reverse defaults to true and reflects.
    expect(el.hasAttribute('reverse')).toBe(true)
    el.reverse = false
    await elementUpdated(el)
    expect(el.hasAttribute('reverse')).toBe(false)
  })
})
