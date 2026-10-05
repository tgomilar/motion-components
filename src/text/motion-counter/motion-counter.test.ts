import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion, stubIntersectionObserver, waitFor } from '../../test/helpers.js'
import type { IntersectionHandle } from '../../test/helpers.js'
import type { MotionCounter } from './motion-counter.js'
import './motion-counter.js'

const text = (el: MotionCounter) => el.shadowRoot?.textContent?.trim()
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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

  it('snaps back to `from` and counts again with loop', async () => {
    const el = (await fixture(
      html`<motion-counter
        from="0"
        to="100"
        duration="0.3"
        loop
        hold="0.1"
        gap="0.1"
      ></motion-counter>`,
    )) as MotionCounter
    io.enter()
    await waitFor(() => text(el) === '100', 'never reached `to`')
    await waitFor(() => text(el) === '0', 'never snapped back to `from`')
    await waitFor(() => text(el) === '100', 'never counted again')
  })

  it('keeps running past `to` with loop instead of settling', async () => {
    const el = (await fixture(
      html`<motion-counter from="0" to="100" loop hold="0.1"></motion-counter>`,
    )) as MotionCounter
    io.enter()
    await waitFor(() => text(el) === '100', 'never reached `to`')
    await wait(80)
    expect(el.playState).toBe('running')
  })

  it('restarts the loop on every entry with loop', async () => {
    const el = (await fixture(
      html`<motion-counter from="0" to="100" duration="0.3" loop hold="4"></motion-counter>`,
    )) as MotionCounter
    io.enter()
    expect(el.playState).toBe('running')

    io.leave()
    expect(el.playState).toBe('idle')
    expect(text(el)).toBe('0')

    io.enter()
    expect(el.playState).toBe('running')
  })

  it('pauses on hover with pause-on-hover and loop', async () => {
    const el = (await fixture(
      html`<motion-counter
        from="0"
        to="100"
        duration="0.3"
        loop
        hold="0.1"
        gap="0.1"
        pause-on-hover
      ></motion-counter>`,
    )) as MotionCounter
    io.enter()
    await waitFor(() => text(el) === '100', 'never reached `to`')

    el.dispatchEvent(new Event('pointerenter'))
    expect(el.playState).toBe('paused')
    const held = text(el)
    await wait(150)
    expect(text(el)).toBe(held)

    el.dispatchEvent(new Event('pointerleave'))
    expect(el.playState).toBe('running')
  })

  it('ignores pause-on-hover without loop', async () => {
    const el = (await fixture(
      html`<motion-counter from="0" to="100" pause-on-hover></motion-counter>`,
    )) as MotionCounter
    io.enter()
    el.dispatchEvent(new Event('pointerenter'))
    expect(el.playState).toBe('running')
  })

  it('stops the loop on cancel', async () => {
    const el = (await fixture(
      html`<motion-counter from="0" to="100" loop hold="4" gap="4"></motion-counter>`,
    )) as MotionCounter
    io.enter()
    el.cancel()
    expect(el.playState).toBe('idle')
    expect(text(el)).toBe('0')
  })

  it('never starts the loop under reduced motion', async () => {
    stubReducedMotion(true)
    const el = (await fixture(
      html`<motion-counter from="0" to="100" loop></motion-counter>`,
    )) as MotionCounter
    io.enter()
    await elementUpdated(el)
    expect(text(el)).toBe('100')
    expect(el.playState).toBe('finished')
  })
})
