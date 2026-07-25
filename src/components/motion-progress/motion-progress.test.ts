import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion, waitForEvent } from '../../test/helpers.js'
import type { MotionProgress } from './motion-progress.js'
import './motion-progress.js'

const bar = (el: MotionProgress) => el.shadowRoot!.querySelector<HTMLElement>('.bar')!

describe('motion-progress', () => {
  beforeEach(() => stubReducedMotion(false))

  it('renders a fixed progressbar with an accessible label', async () => {
    const el = (await fixture(html`<motion-progress></motion-progress>`)) as MotionProgress
    await elementUpdated(el)
    const b = bar(el)
    expect(b.getAttribute('role')).toBe('progressbar')
    expect(b.getAttribute('aria-label')).toBe('Reading progress')
  })

  it('binds to scroll and reports running after connect', async () => {
    const el = (await fixture(html`<motion-progress></motion-progress>`)) as MotionProgress
    await elementUpdated(el)
    expect(el.playState).toBe('running')
  })

  it('reflects position, color and thickness onto the bar', async () => {
    const el = (await fixture(
      html`<motion-progress position="bottom" color="#ff0000" thickness="5"></motion-progress>`,
    )) as MotionProgress
    await elementUpdated(el)
    expect(el.getAttribute('position')).toBe('bottom')
    const b = bar(el)
    expect(b.style.bottom).toBe('0px')
    expect(b.style.top).toBe('auto')
    expect(b.style.height).toBe('5px')
    expect(b.style.background).toBe('rgb(255, 0, 0)')
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
