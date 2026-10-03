import { describe, it, expect } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubIntersectionObserver, stubReducedMotion } from './helpers.js'
import type { MotionStagger } from '../reveal/motion-stagger/motion-stagger.js'
import '../reveal/motion-stagger/motion-stagger.js'

describe('motion-stagger', () => {
  it('shows a child that is added after the reveal', async () => {
    stubReducedMotion(false)
    const io = stubIntersectionObserver()
    const el = (await fixture(
      html`<motion-stagger><div>One</div></motion-stagger>`,
    )) as MotionStagger
    await elementUpdated(el)
    io.enter()
    el.finish()

    const late = document.createElement('div')
    late.textContent = 'Two'
    el.append(late)
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(getComputedStyle(late).opacity).toBe('1')
  })
})
