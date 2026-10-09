import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion, waitForEvent } from '../../test/helpers.js'
import type { MotionProgress } from './motion-progress.js'
import './motion-progress.js'

const bar = (el: MotionProgress) => el.shadowRoot!.querySelector<HTMLElement>('.bar')!
const scale = (el: MotionProgress) => parseFloat(bar(el).style.transform.slice('scaleX('.length))
const frames = async (n: number) => {
  for (let i = 0; i < n; i++) await new Promise(requestAnimationFrame)
}

describe('motion-progress', () => {
  beforeEach(() => stubReducedMotion(false))

  it('hides the decorative bar from screen readers', async () => {
    const el = (await fixture(html`<motion-progress></motion-progress>`)) as MotionProgress
    await elementUpdated(el)
    const b = bar(el)
    expect(b.getAttribute('aria-hidden')).toBe('true')
    expect(b.hasAttribute('role')).toBe(false)
  })

  it('follows scrolling directly under reduced motion', async () => {
    stubReducedMotion(true)
    const spacer = document.createElement('div')
    spacer.style.height = '4000px'
    document.body.append(spacer)
    window.scrollTo(0, 0)
    try {
      const el = (await fixture(html`<motion-progress></motion-progress>`)) as MotionProgress
      await elementUpdated(el)
      await frames(3)
      expect(scale(el)).toBe(0)
      expect(el.playState).toBe('running')

      const max = document.documentElement.scrollHeight - window.innerHeight
      window.scrollTo(0, max / 2)
      await frames(3)
      expect(scale(el)).toBeCloseTo(0.5, 1)

      el.cancel()
      window.scrollTo(0, max)
      await frames(3)
      expect(scale(el)).toBe(0)
    } finally {
      spacer.remove()
      window.scrollTo(0, 0)
    }
  })

  it('binds to scroll and reports running after connect', async () => {
    const el = (await fixture(html`<motion-progress></motion-progress>`)) as MotionProgress
    await elementUpdated(el)
    expect(el.playState).toBe('running')
  })

  it('reflects position and thickness onto the bar and colors it from --mc-progress-color', async () => {
    const el = (await fixture(
      html`<motion-progress
        position="bottom"
        thickness="5"
        style="--mc-progress-color: #ff0000"
      ></motion-progress>`,
    )) as MotionProgress
    await elementUpdated(el)
    expect(el.getAttribute('position')).toBe('bottom')
    const b = bar(el)
    expect(b.style.bottom).toBe('0px')
    expect(b.style.top).toBe('auto')
    expect(b.style.height).toBe('5px')
    expect(getComputedStyle(b).backgroundColor).toBe('rgb(255, 0, 0)')
  })

  it('finish() settles the bar to fully filled and fires motion-finish', async () => {
    const el = (await fixture(html`<motion-progress></motion-progress>`)) as MotionProgress
    await elementUpdated(el)
    const finished = waitForEvent(el, 'motion-finish')
    el.finish()
    await finished
    expect(el.playState).toBe('finished')
    expect(bar(el).style.transform).toBe('scaleX(1)')
  })

  it('cancel() resets the bar toward empty and returns to idle', async () => {
    const el = (await fixture(html`<motion-progress></motion-progress>`)) as MotionProgress
    await elementUpdated(el)
    el.cancel()
    expect(el.playState).toBe('idle')
    expect(bar(el).style.transform).toBe('scaleX(0)')
  })

  it('pause() halts playback without finishing', async () => {
    const el = (await fixture(html`<motion-progress></motion-progress>`)) as MotionProgress
    await elementUpdated(el)
    expect(el.playState).toBe('running')
    el.pause()
    expect(el.playState).toBe('paused')
  })
})
