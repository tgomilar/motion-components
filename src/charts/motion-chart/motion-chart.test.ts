import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, elementUpdated } from '@open-wc/testing-helpers'
import { stubIntersectionObserver, stubReducedMotion } from '../../test/helpers.js'
import type { MotionChart } from './motion-chart.js'
import './motion-chart.js'

async function mount(html: string) {
  const host = document.createElement('div')
  host.innerHTML = html
  const el = (await fixture(host.firstElementChild!)) as MotionChart
  el.style.width = '400px'
  await new Promise((resolve) => setTimeout(resolve, 50))
  await elementUpdated(el)
  return el
}

const bars = (el: MotionChart) => [
  ...el.shadowRoot!.querySelectorAll<SVGPathElement>('svg path[fill]'),
]
const height = (path: SVGPathElement) => path.getBBox().height

describe('motion-chart', () => {
  beforeEach(() => stubReducedMotion(false))

  it('draws one bar per value and grows them when scrolled into view', async () => {
    const io = stubIntersectionObserver()
    const el = await mount('<motion-chart values="10, 20, 5" labels="A, B, C"></motion-chart>')
    expect(bars(el)).toHaveLength(3)
    expect(el.playState).toBe('idle')
    expect(height(bars(el)[1])).toBeLessThan(1)
    io.enter()
    expect(el.playState).toBe('running')
    await el.finished
    await elementUpdated(el)
    expect(height(bars(el)[1])).toBeGreaterThan(height(bars(el)[0]))
  })

  it('reads its data from a table and shows a legend for several series', async () => {
    const el = await mount(`<motion-chart trigger="mount">
      <table>
        <tr><th>Month</th><th>Visitors</th><th>Signups</th></tr>
        <tr><td>Jan</td><td>1200</td><td>80</td></tr>
        <tr><td>Feb</td><td>1850</td><td>124</td></tr>
      </table>
    </motion-chart>`)
    expect(bars(el)).toHaveLength(4)
    expect(el.shadowRoot!.querySelector('.legend')!.textContent).toContain('Signups')
  })

  it('springs to new values when the data changes', async () => {
    const el = await mount('<motion-chart trigger="mount" values="10, 10"></motion-chart>')
    await el.finished
    await elementUpdated(el)
    const before = height(bars(el)[0])
    el.values = '10, 40'
    await elementUpdated(el)
    await new Promise((resolve) => setTimeout(resolve, 1200))
    await elementUpdated(el)
    expect(height(bars(el)[0])).toBeLessThan(before / 2)
    expect(height(bars(el)[1])).toBeGreaterThan(height(bars(el)[0]) * 3)
  })

  it('updates when a table cell changes', async () => {
    stubReducedMotion(true)
    const el = await mount(`<motion-chart trigger="mount">
      <table><tr><td>A</td><td>5</td></tr><tr><td>B</td><td>5</td></tr></table>
    </motion-chart>`)
    el.querySelector('tr td:last-child')!.textContent = '50'
    await new Promise((resolve) => setTimeout(resolve))
    await elementUpdated(el)
    expect(height(bars(el)[0])).toBeGreaterThan(height(bars(el)[1]) * 2)
  })

  it('moves between points with the keyboard and announces the value', async () => {
    const el = await mount(
      '<motion-chart trigger="mount" values="3, 7" labels="Mon, Tue" format="percent"></motion-chart>',
    )
    const plot = el.shadowRoot!.querySelector<HTMLElement>('.plot')!
    plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }))
    await elementUpdated(el)
    expect(el.shadowRoot!.querySelector('[aria-live]')!.textContent).toMatch(/Tue: 7\s?%/)
    expect(el.shadowRoot!.querySelector('.tip-label')!.textContent).toBe('Tue')
  })

  it('draws a line chart with a hidden data table for screen readers', async () => {
    stubReducedMotion(true)
    const el = await mount(
      '<motion-chart type="line" trigger="mount" values="1, 4, 2" label="Sales"></motion-chart>',
    )
    expect(el.shadowRoot!.querySelector('.series-line')!.getAttribute('stroke-dashoffset')).toBe(
      '0',
    )
    const table = el.shadowRoot!.querySelector('.sr-only table')!
    expect(table.querySelector('caption')!.textContent).toBe('Sales')
    expect(table.querySelectorAll('td')).toHaveLength(3)
  })

  it('shows the final state at once under reduced motion', async () => {
    stubReducedMotion(true)
    const el = await mount('<motion-chart trigger="mount" values="4, 8"></motion-chart>')
    expect(el.playState).toBe('finished')
    expect(height(bars(el)[1])).toBeGreaterThan(height(bars(el)[0]))
  })

  it('plays the entrance again after it is removed and added back', async () => {
    const io = stubIntersectionObserver()
    const el = await mount('<motion-chart values="10, 20" labels="A, B"></motion-chart>')
    const parent = el.parentElement!
    el.remove()
    parent.append(el)
    await elementUpdated(el)
    io.enter()
    expect(el.playState).toBe('running')
    await el.finished
    await elementUpdated(el)
    expect(height(bars(el)[1])).toBeGreaterThan(height(bars(el)[0]))
  })

  it('switches to the initial state of the new type before the entrance', async () => {
    stubIntersectionObserver()
    const el = await mount('<motion-chart values="10, 20" labels="A, B"></motion-chart>')
    el.type = 'line'
    await elementUpdated(el)
    expect(el.shadowRoot!.querySelector('.series-line')!.getAttribute('stroke-dashoffset')).toBe(
      '1',
    )
  })

  it('keeps bars inside the chart while the scale shrinks', async () => {
    const el = await mount(
      '<motion-chart trigger="mount" values="12900, 11200" labels="A, B"></motion-chart>',
    )
    await el.finished
    await elementUpdated(el)
    el.values = '3100, 2400'
    let highest = Infinity
    const start = performance.now()
    while (performance.now() - start < 900) {
      await new Promise((resolve) => requestAnimationFrame(resolve))
      await elementUpdated(el)
      for (const bar of bars(el)) highest = Math.min(highest, bar.getBBox().y)
    }
    expect(highest).toBeGreaterThanOrEqual(0)
    const ticks = [...el.shadowRoot!.querySelectorAll('.tick')].map((t) => t.textContent)
    expect(ticks).toContain('4,000')
    expect(ticks).not.toContain('15,000')
  })
})
