import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion, stubIntersectionObserver } from '../../test/helpers.js'
import type { IntersectionHandle } from '../../test/helpers.js'
import type { MotionTypewriter } from './motion-typewriter.js'
import './motion-typewriter.js'

const text = (el: MotionTypewriter) => el.shadowRoot?.textContent?.trim()

describe('motion-typewriter', () => {
  let io: IntersectionHandle

  beforeEach(() => {
    stubReducedMotion(false)
    io = stubIntersectionObserver()
  })

  it('renders nothing typed before it scrolls into view', async () => {
    const el = (await fixture(
      html`<motion-typewriter>Hello, world.</motion-typewriter>`,
    )) as MotionTypewriter
    expect(text(el)).toBe('')
    expect(el.playState).toBe('idle')
  })

  it('starts typing when it scrolls into view', async () => {
    const el = (await fixture(
      html`<motion-typewriter>Hello, world.</motion-typewriter>`,
    )) as MotionTypewriter
    io.enter()
    expect(el.playState).toBe('running')
  })

  it('finish() jumps straight to the full text', async () => {
    const el = (await fixture(
      html`<motion-typewriter>Hello, world.</motion-typewriter>`,
    )) as MotionTypewriter
    io.enter()
    el.finish()
    await elementUpdated(el)
    expect(text(el)).toBe('Hello, world.')
    expect(el.playState).toBe('finished')
    await expect(el.finished).resolves.toBeUndefined()
  })

  it('reduced motion shows the full text immediately without a trigger', async () => {
    stubReducedMotion(true)
    const el = (await fixture(
      html`<motion-typewriter>Hello, world.</motion-typewriter>`,
    )) as MotionTypewriter
    await elementUpdated(el)
    expect(text(el)).toBe('Hello, world.')
  })

  it('replay() resets to running from a finished state', async () => {
    const el = (await fixture(
      html`<motion-typewriter>Hello, world.</motion-typewriter>`,
    )) as MotionTypewriter
    io.enter()
    el.finish()
    await elementUpdated(el)
    expect(text(el)).toBe('Hello, world.')

    el.replay()
    expect(el.playState).toBe('running')
  })

  it('omits the caret span when cursor is disabled', async () => {
    const el = (await fixture(
      html`<motion-typewriter cursor="false">Hi</motion-typewriter>`,
    )) as MotionTypewriter
    // Boolean property: absence handled via attribute; explicitly turn it off.
    el.cursor = false
    await elementUpdated(el)
    expect(el.shadowRoot?.querySelector('.cursor')).toBeNull()
  })
})
