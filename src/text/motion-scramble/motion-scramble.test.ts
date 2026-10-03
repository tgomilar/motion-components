import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion, stubIntersectionObserver } from '../../test/helpers.js'
import type { IntersectionHandle } from '../../test/helpers.js'
import type { MotionScramble } from './motion-scramble.js'
import './motion-scramble.js'

const text = (el: MotionScramble) => el.shadowRoot?.textContent?.trim()

describe('motion-scramble', () => {
  let io: IntersectionHandle

  beforeEach(() => {
    stubReducedMotion(false)
    io = stubIntersectionObserver()
  })

  it('renders the full text before it scrolls into view', async () => {
    const el = (await fixture(html`<motion-scramble>DECODE_ME</motion-scramble>`)) as MotionScramble
    expect(text(el)).toBe('DECODE_ME')
    expect(el.playState).toBe('idle')
  })

  it('starts scrambling when it scrolls into view', async () => {
    const el = (await fixture(html`<motion-scramble>DECODE_ME</motion-scramble>`)) as MotionScramble
    io.enter()
    expect(el.playState).toBe('running')
  })

  it('finish() settles on the original text', async () => {
    const el = (await fixture(html`<motion-scramble>DECODE_ME</motion-scramble>`)) as MotionScramble
    io.enter()
    el.finish()
    await elementUpdated(el)
    expect(text(el)).toBe('DECODE_ME')
    expect(el.playState).toBe('finished')
    await expect(el.finished).resolves.toBeUndefined()
  })

  it('reduced motion leaves the text fully resolved without a trigger', async () => {
    stubReducedMotion(true)
    const el = (await fixture(html`<motion-scramble>DECODE_ME</motion-scramble>`)) as MotionScramble
    await elementUpdated(el)
    expect(text(el)).toBe('DECODE_ME')
    expect(el.playState).toBe('idle')
  })

  it('reflects the hover trigger', async () => {
    const el = (await fixture(
      html`<motion-scramble trigger="hover">DECODE_ME</motion-scramble>`,
    )) as MotionScramble
    expect(el.trigger).toBe('hover')
    expect(el.getAttribute('trigger')).toBe('hover')
    // Hover mode does not observe the viewport, so entering does not start it.
    io.enter()
    expect(el.playState).toBe('idle')
  })

  it('replay() re-runs after finishing', async () => {
    const el = (await fixture(html`<motion-scramble>DECODE_ME</motion-scramble>`)) as MotionScramble
    io.enter()
    el.finish()
    await elementUpdated(el)
    expect(el.playState).toBe('finished')

    el.replay()
    expect(el.playState).toBe('running')
  })
})
