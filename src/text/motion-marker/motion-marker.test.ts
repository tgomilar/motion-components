import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion, stubIntersectionObserver, waitForEvent } from '../../test/helpers.js'
import type { IntersectionHandle } from '../../test/helpers.js'
import type { MotionMarker } from './motion-marker.js'
import './motion-marker.js'

const progress = (el: HTMLElement) => Number(el.style.getPropertyValue('--mc-_mark-progress'))
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function reaches(el: HTMLElement, target: number, timeout = 3000) {
  const start = performance.now()
  while (performance.now() - start < timeout) {
    if (Math.abs(progress(el) - target) < 0.05) return true
    await wait(30)
  }
  return false
}

async function mount(attrs = '', text = 'physical') {
  const host = document.createElement('div')
  host.innerHTML = `<p>Feels <motion-marker duration="0.3" ${attrs}>${text}</motion-marker>.</p>`
  const p = (await fixture(host.firstElementChild!)) as HTMLElement
  const el = p.querySelector('motion-marker') as MotionMarker
  await elementUpdated(el)
  return el
}

describe('motion-marker', () => {
  let io: IntersectionHandle
  beforeEach(() => {
    stubReducedMotion(false)
    io = stubIntersectionObserver()
  })

  it('keeps the text unchanged in the light DOM', async () => {
    const el = await mount()
    expect(el.textContent).toBe('physical')
    expect(el.children).toHaveLength(0)
  })

  it('waits for the view, then draws to the end and fires its events', async () => {
    const el = await mount()
    expect(progress(el)).toBe(0)
    expect(el.playState).toBe('idle')
    const finished = waitForEvent(el, 'motion-finish')
    io.enter()
    expect(el.playState).toBe('running')
    await finished
    expect(progress(el)).toBe(1)
  })

  it('draws only once by default, and on every entry with once="false"', async () => {
    const el = await mount()
    io.enter()
    await el.finished
    io.leave()
    expect(progress(el)).toBe(1)

    const again = await mount('once="false"')
    io.enter()
    await again.finished
    io.leave()
    expect(progress(again)).toBe(0)
  })

  it('draws on connect with trigger="mount"', async () => {
    const el = await mount('trigger="mount"')
    expect(el.playState).toBe('running')
    await el.finished
    expect(progress(el)).toBe(1)
  })

  it('draws on hover and undraws on leave from where it is, without a jump', async () => {
    const el = await mount('trigger="hover"')
    el.dispatchEvent(new PointerEvent('pointerenter'))
    await wait(90)
    const mid = progress(el)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
    el.dispatchEvent(new PointerEvent('pointerleave'))
    await wait(20)
    expect(progress(el)).toBeGreaterThan(0)
    await wait(700)
    expect(progress(el)).toBe(0)
  })

  it('follows the surrounding link with trigger="hover"', async () => {
    const host = document.createElement('div')
    host.innerHTML =
      '<a href="#x"><motion-marker trigger="hover" duration="0.2">Read</motion-marker> more</a>'
    const link = (await fixture(host.firstElementChild!)) as HTMLElement
    const el = link.querySelector('motion-marker') as MotionMarker
    await elementUpdated(el)
    link.dispatchEvent(new PointerEvent('pointerenter'))
    await wait(500)
    expect(progress(el)).toBe(1)
  })

  it('shows the mark at once under reduced motion', async () => {
    stubReducedMotion(true)
    const el = await mount()
    const finished = waitForEvent(el, 'motion-finish')
    io.enter()
    await finished
    expect(progress(el)).toBe(1)

    const hover = await mount('trigger="hover"')
    hover.dispatchEvent(new PointerEvent('pointerenter'))
    expect(progress(hover)).toBe(1)
    hover.dispatchEvent(new PointerEvent('pointerleave'))
    expect(progress(hover)).toBe(0)
  })

  it('cancel() resets, finish() completes and replay() draws again', async () => {
    const el = await mount()
    el.finish()
    expect(progress(el)).toBe(1)
    const cancelled = waitForEvent(el, 'motion-cancel')
    el.replay()
    el.cancel()
    await cancelled
    expect(progress(el)).toBe(0)
    el.replay()
    expect(el.playState).toBe('running')
    await el.finished
    expect(progress(el)).toBe(1)
  })

  it('replay() after a finished drawing draws again from 0', async () => {
    const el = await mount('trigger="mount"')
    await el.finished
    expect(progress(el)).toBe(1)
    el.replay()
    await wait(100)
    expect(progress(el)).toBeGreaterThan(0)
    expect(progress(el)).toBeLessThan(1)
    await el.finished
    expect(progress(el)).toBe(1)
  })

  it('draws, holds and undraws on repeat with loop', async () => {
    const el = await mount('loop hold="0.3" gap="0.2" duration="0.2"', 'x')
    io.enter()
    expect(el.playState).toBe('running')
    expect(await reaches(el, 1)).toBe(true)
    expect(await reaches(el, 0)).toBe(true)
    expect(await reaches(el, 1)).toBe(true)
    expect(el.playState).toBe('running')
  })

  it('a looping run never finishes on its own', async () => {
    const el = await mount('loop duration="0.1"', 'x')
    io.enter()
    await wait(1200)
    expect(el.playState).toBe('running')
    el.cancel()
    expect(progress(el)).toBe(0)
  })

  it('cancel stops a looping run and removes the mark', async () => {
    const el = await mount('loop duration="0.1"', 'x')
    io.enter()
    await wait(300)
    el.cancel()
    expect(progress(el)).toBe(0)
    const before = progress(el)
    await wait(400)
    expect(progress(el)).toBe(before)
  })

  it('pause freezes a looping run and play resumes from the frozen phase', async () => {
    const el = await mount('loop duration="0.6"', 'x')
    io.enter()
    await wait(120)
    el.pause()
    const frozen = progress(el)
    await wait(400)
    expect(progress(el)).toBeCloseTo(frozen, 1)
    el.play()
    expect(await reaches(el, 1)).toBe(true)
  })

  it('pause-on-hover freezes the loop while the pointer is over it', async () => {
    const el = await mount('loop duration="0.6" pause-on-hover', 'x')
    io.enter()
    await wait(120)
    el.dispatchEvent(new PointerEvent('pointermove'))
    expect(el.playState).toBe('paused')
    const frozen = progress(el)
    await wait(400)
    expect(progress(el)).toBeCloseTo(frozen, 1)
    el.dispatchEvent(new PointerEvent('pointerleave'))
    expect(el.playState).toBe('running')
    expect(await reaches(el, 1)).toBe(true)
  })

  it('leaves the viewport and comes back with loop', async () => {
    const el = await mount('loop duration="0.1"', 'x')
    io.enter()
    await wait(200)
    io.leave()
    expect(el.playState).toBe('idle')
    expect(progress(el)).toBe(0)
    io.enter()
    expect(el.playState).toBe('running')
  })

  it('stays drawn at once under reduced motion with loop', async () => {
    stubReducedMotion(true)
    const el = await mount('loop duration="0.1" hold="0.2"', 'x')
    const finished = waitForEvent(el, 'motion-finish')
    io.enter()
    await finished
    expect(progress(el)).toBe(1)
    expect(el.playState).toBe('finished')
  })

  it('draws a wavy stroke behind one line of text with shape="wave"', async () => {
    const el = await mount('trigger="mount" shape="wave"', 'wavy highlight')
    await el.finished
    const svg = el.shadowRoot!.querySelector('svg')!
    const path = svg.querySelector('path')!
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(path.getAttribute('d')).toMatch(/^M[\d.]+ [\d.]+ Q.* T/)
    expect(getComputedStyle(el).backgroundImage).toBe('none')
    expect(getComputedStyle(svg).zIndex).toBe('-1')
    expect(svg.getBoundingClientRect().width).toBeCloseTo(el.offsetWidth, 0)
    expect(el.getClientRects()).toHaveLength(1)
    expect(progress(el)).toBe(1)
  })

  it('paints the highlight on every line of a phrase that wraps', async () => {
    const host = document.createElement('div')
    host.innerHTML =
      '<p style="width: 6ch; font: 16px monospace">A <motion-marker trigger="mount">long phrase that wraps</motion-marker></p>'
    const p = (await fixture(host.firstElementChild!)) as HTMLElement
    const el = p.querySelector('motion-marker') as MotionMarker
    await elementUpdated(el)
    expect(el.getClientRects().length).toBeGreaterThan(1)
    const style = getComputedStyle(el)
    expect(style.boxDecorationBreak || style.getPropertyValue('-webkit-box-decoration-break')).toBe(
      'clone',
    )
    expect(style.backgroundImage).toContain('linear-gradient')
  })
})
