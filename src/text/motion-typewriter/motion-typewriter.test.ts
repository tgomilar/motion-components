import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion, stubIntersectionObserver } from '../../test/helpers.js'
import type { IntersectionHandle } from '../../test/helpers.js'

// The caret blink runs through Motion, so we mock `animate` and assert the
// keyframes handed to it and that its controls are stopped.
const { animateMock, controls } = vi.hoisted(() => {
  const controls = { stop: vi.fn() }
  return { controls, animateMock: vi.fn((..._args: unknown[]) => controls) }
})
vi.mock('motion', () => ({ animate: animateMock }))

import type { MotionTypewriter } from './motion-typewriter.js'
import './motion-typewriter.js'

const text = (el: MotionTypewriter) =>
  el.shadowRoot?.querySelector('[aria-hidden="true"]')?.textContent?.trim()
const caret = (el: MotionTypewriter) => el.shadowRoot!.querySelector<HTMLElement>('.cursor')!

describe('motion-typewriter', () => {
  let io: IntersectionHandle

  beforeEach(() => {
    stubReducedMotion(false)
    vi.clearAllMocks()
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

  it('keeps its text when it is removed and added back', async () => {
    stubReducedMotion(true)
    const el = (await fixture(
      html`<motion-typewriter>Hello, world.</motion-typewriter>`,
    )) as MotionTypewriter
    const parent = el.parentElement!
    el.remove()
    parent.append(el)
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

  it('exposes the full text to screen readers before and while it types', async () => {
    const el = (await fixture(
      html`<motion-typewriter>Hello, world.</motion-typewriter>`,
    )) as MotionTypewriter
    const hidden = el.shadowRoot!.querySelector('.sr-only')!
    expect(hidden.textContent).toBe('Hello, world.')
    expect(hidden.closest('[aria-hidden]')).toBeNull()
    expect(caret(el).closest('[aria-hidden="true"]')).not.toBeNull()

    io.enter()
    await elementUpdated(el)
    expect(el.playState).toBe('running')
    expect(hidden.textContent).toBe('Hello, world.')
  })

  it('blinks the caret with Motion, not a CSS animation, and stops it on disconnect', async () => {
    const el = (await fixture(
      html`<motion-typewriter>Hello, world.</motion-typewriter>`,
    )) as MotionTypewriter
    expect(getComputedStyle(caret(el)).animationName).toBe('none')
    expect(animateMock).toHaveBeenCalledOnce()
    const [target, keyframes, options] = animateMock.mock.calls[0]
    expect(target).toBe(caret(el))
    expect(keyframes).toMatchObject({ opacity: [1, 0] })
    expect(options).toMatchObject({ repeat: Infinity })

    el.remove()
    expect(controls.stop).toHaveBeenCalled()
  })

  it('keeps the caret still under reduced motion', async () => {
    stubReducedMotion(true)
    const el = (await fixture(
      html`<motion-typewriter>Hello, world.</motion-typewriter>`,
    )) as MotionTypewriter
    await elementUpdated(el)
    expect(getComputedStyle(caret(el)).animationName).toBe('none')
    expect(animateMock).not.toHaveBeenCalled()
  })
})
