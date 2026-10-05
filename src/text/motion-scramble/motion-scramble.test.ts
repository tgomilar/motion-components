import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion, stubIntersectionObserver, waitFor } from '../../test/helpers.js'
import type { IntersectionHandle } from '../../test/helpers.js'
import type { MotionScramble } from './motion-scramble.js'
import './motion-scramble.js'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const text = (el: MotionScramble) => el.shadowRoot?.textContent?.trim()

describe('motion-scramble', () => {
  let io: IntersectionHandle

  beforeEach(() => {
    stubReducedMotion(false)
    io = stubIntersectionObserver()
  })

  afterEach(() => {
    for (const el of document.querySelectorAll('motion-scramble')) el.remove()
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

  it('honors delay on the first run', async () => {
    const el = (await fixture(
      html`<motion-scramble delay="0.3">DECODE_ME</motion-scramble>`,
    )) as MotionScramble
    io.enter()
    expect(el.playState).toBe('running')

    await wait(60)
    expect(text(el)).toBe('DECODE_ME')

    await waitFor(() => text(el) !== 'DECODE_ME', 'never started scrambling')
  })

  it('cancel() during the delay never scrambles', async () => {
    const el = (await fixture(
      html`<motion-scramble delay="0.3">DECODE_ME</motion-scramble>`,
    )) as MotionScramble
    io.enter()
    el.cancel()
    expect(el.playState).toBe('idle')

    await wait(400)
    expect(text(el)).toBe('DECODE_ME')
  })

  it('with loop, keeps running past the first resolve', async () => {
    const el = (await fixture(
      html`<motion-scramble loop hold="0.1" gap="0.1">DECODE_ME</motion-scramble>`,
    )) as MotionScramble
    io.enter()
    expect(el.playState).toBe('running')

    await waitFor(() => text(el) === 'DECODE_ME', 'never resolved')
    await wait(60)
    expect(el.playState).toBe('running')
  })

  it('with loop, cancels on leave and restarts on the next entry', async () => {
    const el = (await fixture(
      html`<motion-scramble loop hold="4">DECODE_ME</motion-scramble>`,
    )) as MotionScramble
    io.enter()
    expect(el.playState).toBe('running')

    io.leave()
    expect(el.playState).toBe('idle')

    io.enter()
    expect(el.playState).toBe('running')
  })

  it('pauses on hover with pause-on-hover and loop', async () => {
    const el = (await fixture(
      html`<motion-scramble loop hold="4" gap="4" pause-on-hover>DECODE_ME</motion-scramble>`,
    )) as MotionScramble
    io.enter()
    await wait(40)

    el.dispatchEvent(new Event('pointermove'))
    expect(el.playState).toBe('paused')

    el.dispatchEvent(new Event('pointerleave'))
    expect(el.playState).toBe('running')
  })

  it('never starts the loop under reduced motion', async () => {
    stubReducedMotion(true)
    const el = (await fixture(
      html`<motion-scramble loop>DECODE_ME</motion-scramble>`,
    )) as MotionScramble
    await elementUpdated(el)
    io.enter()
    expect(text(el)).toBe('DECODE_ME')
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
