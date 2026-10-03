import { describe, it, expect } from 'vitest'
import { formatter, fromTable, fromValues, niceScale } from './chart-data.js'

const table = (html: string) => {
  const el = document.createElement('table')
  el.innerHTML = html
  return el
}

describe('fromValues', () => {
  it('reads one series with labels', () => {
    expect(fromValues('12, 19, 8', 'Mon, Tue, Wed')).toEqual({
      labels: ['Mon', 'Tue', 'Wed'],
      series: [{ name: '', values: [12, 19, 8] }],
    })
  })

  it('reads several series separated by semicolons and pads short ones', () => {
    const data = fromValues('1, 2, 3; 4, 5', '', 'A, B')
    expect(data.labels).toEqual(['1', '2', '3'])
    expect(data.series).toEqual([
      { name: 'A', values: [1, 2, 3] },
      { name: 'B', values: [4, 5, 0] },
    ])
  })
})

describe('fromTable', () => {
  it('uses the first column as labels and the header row as series names', () => {
    const data = fromTable(
      table(
        '<tr><th>Month</th><th>Visitors</th><th>Signups</th></tr><tr><td>Jan</td><td>1,200</td><td>80</td></tr><tr><td>Feb</td><td>1850</td><td>124</td></tr>',
      ),
    )
    expect(data).toEqual({
      labels: ['Jan', 'Feb'],
      series: [
        { name: 'Visitors', values: [1200, 1850] },
        { name: 'Signups', values: [80, 124] },
      ],
    })
  })

  it('reads a table without a header row', () => {
    const data = fromTable(table('<tr><td>Jan</td><td>5</td></tr><tr><td>Feb</td><td>7</td></tr>'))
    expect(data.series).toEqual([{ name: '', values: [5, 7] }])
  })
})

describe('niceScale', () => {
  it('rounds the range out to clean ticks', () => {
    expect(niceScale(0, 24)).toEqual({ min: 0, max: 25, ticks: [0, 5, 10, 15, 20, 25] })
    expect(niceScale(0, 1850).ticks).toEqual([0, 500, 1000, 1500, 2000])
  })

  it('handles negative values and a flat range', () => {
    expect(niceScale(-12, 30).min).toBeLessThanOrEqual(-12)
    expect(niceScale(5, 5).ticks.length).toBeGreaterThan(1)
  })
})

describe('formatter', () => {
  it('formats compact, percent and currency values', () => {
    expect(formatter('compact')(12900)).toMatch(/12\.9\s?K/)
    expect(formatter('percent')(12)).toMatch(/12\s?%/)
    expect(formatter('currency:EUR')(4)).toMatch(/€/)
  })

  it('falls back to plain numbers for an unknown currency', () => {
    expect(formatter('currency:NOPE')(1200)).toMatch(/1.?200/)
  })
})

describe('review fixes', () => {
  it('reads a first row with currency or percent values as data, not as a header', () => {
    const data = fromTable(
      table('<tr><td>Jan</td><td>$1,200</td></tr><tr><td>Feb</td><td>12%</td></tr>'),
    )
    expect(data.labels).toEqual(['Jan', 'Feb'])
    expect(data.series).toEqual([{ name: '', values: [1200, 12] }])
  })

  it('keeps a usable scale when min is above max', () => {
    const scale = niceScale(20, 15)
    expect(scale.ticks.length).toBeGreaterThan(1)
    expect(scale.ticks.every(Number.isFinite)).toBe(true)
  })
})
