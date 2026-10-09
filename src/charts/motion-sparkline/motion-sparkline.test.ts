import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, elementUpdated } from '@open-wc/testing-helpers'
import { stubIntersectionObserver, stubReducedMotion } from '../../test/helpers.js'
import type { MotionSparkline } from './motion-sparkline.js'
import './motion-sparkline.js'

async function mount(attrs: string) {
  const host = document.createElement('div')
  host.innerHTML = `<motion-sparkline ${attrs}></motion-sparkline>`
  const el = (await fixture(host.firstElementChild!)) as MotionSparkline
  await new Promise((resolve) => requestAnimationFrame(resolve))
  await elementUpdated(el)
  return el
}

const line = (el: MotionSparkline) => el.shadowRoot!.querySelector<SVGPathElement>('.line')!

describe('motion-sparkline', () => {
  beforeEach(() => stubReducedMotion(false))

  it('describes the trend for screen readers', async () => {
    const el = await mount('values="3, 5, 4, 11"')
    expect(el.getAttribute('role')).toBe('img')
    expect(el.getAttribute('aria-label')).toBe('from 3 to 11, low 3, high 11')
  })

  it('takes its numbers from data, ahead of values', async () => {
    const el = await mount('values="3, 5"')
    el.data = [2, 9, 4]
    await elementUpdated(el)
    expect(el.getAttribute('aria-label')).toBe('from 2 to 4, low 2, high 9')
    el.data = null
    await elementUpdated(el)
    expect(el.getAttribute('aria-label')).toBe('from 3 to 5, low 3, high 5')
  })

  it('draws in when scrolled into view', async () => {
    const io = stubIntersectionObserver()
    const el = await mount('values="3, 5, 4, 11"')
    expect(line(el).getAttribute('stroke-dashoffset')).toBe('1')
    io.enter()
    await el.finished
    await elementUpdated(el)
    expect(Number(line(el).getAttribute('stroke-dashoffset'))).toBeCloseTo(0, 2)
    expect(el.shadowRoot!.querySelector('.dot')).not.toBeNull()
  })

  it('springs to new values', async () => {
    const el = await mount('values="1, 2, 3" trigger="mount"')
    await el.finished
    await elementUpdated(el)
    const before = line(el).getAttribute('d')
    el.values = '3, 2, 1'
    await new Promise((resolve) => setTimeout(resolve, 900))
    await elementUpdated(el)
    expect(line(el).getAttribute('d')).not.toBe(before)
    expect(el.getAttribute('aria-label')).toBe('from 3 to 1, low 1, high 3')
  })

  it('draws in again after it is removed and added back', async () => {
    const io = stubIntersectionObserver()
    const el = await mount('values="3, 5, 4, 11"')
    const parent = el.parentElement!
    el.remove()
    parent.append(el)
    await elementUpdated(el)
    io.enter()
    await el.finished
    await elementUpdated(el)
    expect(Number(line(el).getAttribute('stroke-dashoffset'))).toBeCloseTo(0, 2)
  })
})
