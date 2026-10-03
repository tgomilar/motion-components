import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fixture, elementUpdated } from '@open-wc/testing-helpers'
import { stubIntersectionObserver, stubReducedMotion } from '../../test/helpers.js'
import type { MotionIcon } from './motion-icon.js'
import './motion-icon.js'

const STROKE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16"/><path d="M12 4v16"/></svg>`
const FILLED = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v16H4z"/></svg>`

async function mount(attrs = '', inner = STROKE) {
  const host = document.createElement('div')
  host.innerHTML = `<motion-icon ${attrs}>${inner}</motion-icon>`
  const el = (await fixture(host.firstElementChild!)) as MotionIcon
  await elementUpdated(el)
  return el
}

const strokes = (el: MotionIcon) => [...el.querySelectorAll<SVGPathElement>('path')]

describe('motion-icon', () => {
  beforeEach(() => stubReducedMotion(false))

  it('is decorative by default and named with label', async () => {
    const el = await mount()
    expect(el.getAttribute('aria-hidden')).toBe('true')
    el.label = 'Add'
    await elementUpdated(el)
    expect(el.getAttribute('role')).toBe('img')
    expect(el.getAttribute('aria-label')).toBe('Add')
    expect(el.hasAttribute('aria-hidden')).toBe(false)
  })

  it('prepares stroke shapes for drawing and leaves them visible for hover', async () => {
    const el = await mount()
    for (const p of strokes(el)) {
      expect(p.getAttribute('pathLength')).toBe('1')
      expect(p.style.strokeDashoffset).toBe('0')
    }
  })

  it('draws the strokes in on hover', async () => {
    const el = await mount()
    el.dispatchEvent(new PointerEvent('pointerenter'))
    expect(el.playState).toBe('running')
    await el.finished
    expect(el.playState).toBe('finished')
    expect(Number(getComputedStyle(strokes(el)[0]).strokeDashoffset.replace('px', ''))).toBeCloseTo(
      0,
    )
  })

  it('starts hidden and draws in when scrolled into view', async () => {
    const io = stubIntersectionObserver()
    const el = await mount('trigger="view"')
    expect(strokes(el)[0].style.strokeDashoffset).toBe('1')
    io.enter()
    expect(el.playState).toBe('running')
  })

  it('falls back from draw to pop for filled icons', async () => {
    const el = await mount('trigger="click"', FILLED)
    expect(el.querySelector('path')!.hasAttribute('pathLength')).toBe(false)
    el.click()
    expect(el.playState).toBe('running')
  })

  it('renders an icon string and removes script and handlers', async () => {
    const el = await mount('', '')
    el.icon = `<svg viewBox="0 0 24 24" onload="alert(1)" stroke="currentColor"><script>alert(1)</script><path d="M4 12h16" onclick="alert(1)"/></svg>`
    await elementUpdated(el)
    const svg = el.shadowRoot!.querySelector('.icon svg')!
    expect(svg).not.toBeNull()
    expect(svg.hasAttribute('onload')).toBe(false)
    expect(svg.querySelector('script')).toBeNull()
    expect(svg.querySelector('path')!.hasAttribute('onclick')).toBe(false)
  })

  it('loops with a pause between runs', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const el = await mount('trigger="loop" interval="0.5"')
    el.finish()
    expect(el.playState).toBe('finished')
    vi.advanceTimersByTime(500)
    expect(el.playState).toBe('running')
    vi.useRealTimers()
    el.remove()
  })

  it('shows the final state at once under reduced motion', async () => {
    stubReducedMotion(true)
    const el = await mount('trigger="mount"')
    expect(el.playState).toBe('finished')
    expect(strokes(el)[0].style.strokeDashoffset).toBe('0')
  })
})
