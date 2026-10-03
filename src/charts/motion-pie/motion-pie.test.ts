import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, elementUpdated } from '@open-wc/testing-helpers'
import { stubIntersectionObserver, stubReducedMotion } from '../../test/helpers.js'
import type { MotionPie } from './motion-pie.js'
import './motion-pie.js'

async function mount(html: string) {
  const host = document.createElement('div')
  host.innerHTML = html
  const el = (await fixture(host.firstElementChild!)) as MotionPie
  el.style.width = '400px'
  await new Promise((resolve) => setTimeout(resolve, 50))
  await elementUpdated(el)
  return el
}

const slices = (el: MotionPie) => [...el.shadowRoot!.querySelectorAll('.slice')]

describe('motion-pie', () => {
  beforeEach(() => stubReducedMotion(false))

  it('draws one slice per label and folds more than six into Other', async () => {
    stubReducedMotion(true)
    const el = await mount(
      '<motion-pie trigger="mount" values="5, 4, 3, 2, 1, 1, 1" labels="A, B, C, D, E, F, G"></motion-pie>',
    )
    expect(slices(el)).toHaveLength(6)
    const legend = el.shadowRoot!.querySelector('.legend')!.textContent!
    expect(legend).toContain('Other')
    expect(legend).toMatch(/18\s?%/)
  })

  it('sweeps in when scrolled into view', async () => {
    const io = stubIntersectionObserver()
    const el = await mount('<motion-pie values="1, 1" labels="A, B"></motion-pie>')
    expect(slices(el)[0].getAttribute('d')).toBe('')
    io.enter()
    await el.finished
    await elementUpdated(el)
    expect(slices(el)[0].getAttribute('d')).not.toBe('')
  })

  it('reads its data from a table', async () => {
    stubReducedMotion(true)
    const el = await mount(`<motion-pie trigger="mount">
      <table>
        <tr><th>Source</th><th>Visits</th></tr>
        <tr><td>Direct</td><td>30</td></tr>
        <tr><td>Search</td><td>10</td></tr>
      </table>
    </motion-pie>`)
    expect(slices(el)).toHaveLength(2)
    expect(el.shadowRoot!.querySelector('.legend')!.textContent).toMatch(/Direct\s*75\s?%/)
  })

  it('shows the total in a donut and the slice value and share on keyboard focus', async () => {
    stubReducedMotion(true)
    const el = await mount(
      '<motion-pie donut trigger="mount" values="30, 10" labels="Rent, Food" total-label="Budget"></motion-pie>',
    )
    expect(el.shadowRoot!.querySelector('.center-value')!.textContent).toBe('40')
    expect(el.shadowRoot!.querySelector('.center-label')!.textContent).toBe('Budget')
    el.shadowRoot!.querySelector('.plot')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End' }),
    )
    await elementUpdated(el)
    expect(el.shadowRoot!.querySelector('.center-value')!.textContent).toBe('10')
    expect(el.shadowRoot!.querySelector('[aria-live]')!.textContent).toMatch(/Food: 10, 25\s?%/)
    expect(el.shadowRoot!.querySelector('.tip')).toBeNull()
  })

  it('springs slices to new sizes when the data changes', async () => {
    const el = await mount('<motion-pie trigger="mount" values="1, 1" labels="A, B"></motion-pie>')
    await el.finished
    await elementUpdated(el)
    const before = slices(el)[0].getAttribute('d')
    el.data = { labels: ['A', 'B'], values: [3, 1] }
    await new Promise((resolve) => setTimeout(resolve, 1200))
    await elementUpdated(el)
    expect(slices(el)[0].getAttribute('d')).not.toBe(before)
    expect(el.shadowRoot!.querySelector('.legend')!.textContent).toMatch(/75\s?%/)
  })

  it('sweeps in again after it is removed and added back', async () => {
    const io = stubIntersectionObserver()
    const el = await mount('<motion-pie values="1, 1" labels="A, B"></motion-pie>')
    const parent = el.parentElement!
    el.remove()
    parent.append(el)
    await elementUpdated(el)
    io.enter()
    await el.finished
    await elementUpdated(el)
    expect(slices(el)[0].getAttribute('d')).not.toBe('')
  })
})
