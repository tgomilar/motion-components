import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion, stubIntersectionObserver } from '../../test/helpers.js'
import type { MotionRing } from './motion-ring.js'
import './motion-ring.js'

async function mount(attrs = '') {
  const host = document.createElement('div')
  host.innerHTML = `<p style="font-size: 20px">Every change is <motion-ring trigger="mount" duration="0.2" ${attrs}>reversible</motion-ring>.</p>`
  const p = (await fixture(host.firstElementChild!)) as HTMLElement
  const el = p.querySelector('motion-ring') as MotionRing
  await elementUpdated(el)
  await new Promise((resolve) => requestAnimationFrame(resolve))
  return el
}

describe('motion-ring', () => {
  beforeEach(() => {
    stubReducedMotion(false)
    stubIntersectionObserver()
  })

  it('draws an ellipse around the text by default, hidden from screen readers', async () => {
    const el = await mount()
    await el.finished
    const svg = el.shadowRoot!.querySelector('svg')!
    const ellipse = svg.querySelector('ellipse')!
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(ellipse.getAttribute('pathLength')).toBe('1')
    expect(Number(ellipse.getAttribute('rx'))).toBeGreaterThan(el.offsetWidth / 2)
    expect(Number(ellipse.getAttribute('ry'))).toBeGreaterThan(0)
    expect(el.style.getPropertyValue('--mc-mark-progress')).toBe('1')
  })

  it('draws a box with shape="box", padding pixels outside the text', async () => {
    const el = await mount('shape="box" padding="10"')
    const rect = el.shadowRoot!.querySelector('svg rect')!
    expect(el.shadowRoot!.querySelector('ellipse')).toBeNull()
    expect(Number(rect.getAttribute('width'))).toBe(el.offsetWidth + 20)
    expect(Number(rect.getAttribute('height'))).toBe(el.offsetHeight + 20)
    expect(el.shadowRoot!.querySelector('svg')!.style.left).toBe('-10px')
  })

  it('keeps its text on one line', async () => {
    const el = await mount()
    expect(getComputedStyle(el).whiteSpace).toBe('nowrap')
    expect(el.getClientRects()).toHaveLength(1)
    expect(el.textContent).toBe('reversible')
  })
})
