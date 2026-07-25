import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, html } from '@open-wc/testing-helpers'
import { stubReducedMotion, stubIntersectionObserver } from '../../test/helpers.js'
import type { IntersectionHandle } from '../../test/helpers.js'
import type { MotionReveal } from './motion-reveal.js'
import './motion-reveal.js'

describe('motion-reveal', () => {
  let io: IntersectionHandle

  beforeEach(() => {
    stubReducedMotion(false)
    io = stubIntersectionObserver()
  })

  async function mount() {
    return (await fixture(
      html`<motion-reveal y="40"><h2>Reveal me</h2></motion-reveal>`,
    )) as MotionReveal
  }

  it('starts hidden and observes the viewport', async () => {
    const el = await mount()
    expect(el.style.opacity).toBe('0')
    expect(io.observed).toContain(el)
    expect(el.playState).toBe('idle')
  })

  it('plays once it intersects and settles to finished', async () => {
    const el = await mount()
    io.enter()
    expect(el.playState).toBe('running')
    el.finish()
    expect(el.playState).toBe('finished')
  })

  it('with `once`, disconnects the observer after the first reveal', async () => {
    const el = await mount()
    io.enter()
    // `once` is true by default → observer disconnected, nothing left observed
    expect(io.observed).not.toContain(el)
  })

  it('under reduced motion, shows content immediately and never observes', async () => {
    stubReducedMotion(true)
    const el = await mount()
    expect(el.style.opacity).toBe('1')
    expect(io.observed).toHaveLength(0)
  })

  it('replay() resets and runs again', async () => {
    const el = await mount()
    io.enter()
    el.finish()
    expect(el.playState).toBe('finished')

    el.replay()
    expect(el.playState).toBe('running')
  })
})
