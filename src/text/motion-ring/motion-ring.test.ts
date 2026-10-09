import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion, stubIntersectionObserver } from '../../test/helpers.js'
import type { MotionRing } from './motion-ring.js'
import './motion-ring.js'

async function mount(attrs = '', lineHeight = 'normal') {
  const host = document.createElement('div')
  host.innerHTML = `<p style="font-size: 20px; line-height: ${lineHeight}">Every change is <motion-ring trigger="mount" duration="0.2" ${attrs}>reversible</motion-ring>.</p>`
  const p = (await fixture(host.firstElementChild!)) as HTMLElement
  const el = p.querySelector('motion-ring') as MotionRing
  await elementUpdated(el)
  await new Promise((resolve) => requestAnimationFrame(resolve))
  return el
}

function textBox(el: HTMLElement) {
  const range = document.createRange()
  range.selectNodeContents(el)
  return range.getBoundingClientRect()
}

const progress = (el: HTMLElement) => Number(el.style.getPropertyValue('--mc-_mark-progress'))
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function until(check: () => boolean, timeout = 3000) {
  const start = performance.now()
  while (!check() && performance.now() - start < timeout) await wait(30)
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
    expect(el.style.getPropertyValue('--mc-_mark-progress')).toBe('1')
  })

  it('draws a box with shape="box", padding pixels outside the text', async () => {
    const el = await mount('shape="box" padding="10"')
    const rect = el.shadowRoot!.querySelector('svg rect')!
    expect(el.shadowRoot!.querySelector('ellipse')).toBeNull()
    const text = textBox(el)
    expect(Number(rect.getAttribute('width'))).toBeCloseTo(text.width + 20, 1)
    expect(Number(rect.getAttribute('height'))).toBeCloseTo(text.height + 20, 1)
    const svg = el.shadowRoot!.querySelector('svg')!.getBoundingClientRect()
    expect(svg.left).toBeCloseTo(text.left - 10, 1)
    expect(svg.top).toBeCloseTo(text.top - 10, 1)
  })

  it('draws and undraws on repeat with loop', async () => {
    const el = await mount('loop duration="0.2" hold="0.3" gap="0.2"')
    await wait(350)
    expect(progress(el)).toBeGreaterThan(0.95)
    await until(() => progress(el) < 0.05)
    expect(progress(el)).toBeLessThan(0.05)
    await until(() => progress(el) > 0.95)
    expect(el.playState).toBe('running')
  })

  it('fits the text, not the line height', async () => {
    const tight = await mount('shape="box"', '1')
    const tightHeight = Number(tight.shadowRoot!.querySelector('rect')!.getAttribute('height'))
    const loose = await mount('shape="box"', '3')
    expect(loose.offsetHeight).toBeGreaterThan(tight.offsetHeight * 2)
    expect(Number(loose.shadowRoot!.querySelector('rect')!.getAttribute('height'))).toBeCloseTo(
      tightHeight,
      1,
    )
  })

  it('takes room beside the text, so the stroke never covers the next word', async () => {
    const el = await mount()
    const ellipse = el.shadowRoot!.querySelector('ellipse')!.getBoundingClientRect()
    const before = document.createRange()
    before.selectNodeContents(el.previousSibling!)
    const after = document.createRange()
    after.selectNodeContents(el.nextSibling!)
    expect(parseFloat(getComputedStyle(el).marginLeft)).toBeGreaterThan(6)
    expect(before.getBoundingClientRect().right).toBeLessThanOrEqual(ellipse.left)
    expect(after.getBoundingClientRect().left).toBeGreaterThanOrEqual(ellipse.right)
  })

  it('keeps its text on one line', async () => {
    const el = await mount()
    expect(getComputedStyle(el).whiteSpace).toBe('nowrap')
    expect(el.getClientRects()).toHaveLength(1)
    expect(el.textContent).toBe('reversible')
  })

  it('closes the whole shape when drawn, and wraps a part drawn stroke around it', async () => {
    const host = document.createElement('div')
    host.innerHTML =
      '<p style="font-size: 40px"><motion-ring trigger="mount">stroke</motion-ring></p>'
    const p = await fixture(host.firstElementChild!)
    const el = p.querySelector('motion-ring') as HTMLElement
    await elementUpdated(el as never)
    const stroke = el.shadowRoot!.querySelector('.stroke')!
    const dashes = () =>
      (getComputedStyle(stroke).strokeDasharray.match(/[\d.]+/g) ?? []).map(Number)
    el.style.setProperty('--mc-_mark-progress', '1')
    el.style.setProperty('--mc-_mark-tail', '0')
    expect(dashes()[0]).toBeCloseTo(1, 2)
    el.style.setProperty('--mc-_mark-progress', '0.3')
    const [dash, gap] = dashes()
    expect(dash + gap).toBeCloseTo(1, 2)
  })
})
