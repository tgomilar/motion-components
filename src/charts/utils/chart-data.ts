export interface ChartSeries {
  name: string
  values: number[]
}

export interface ChartData {
  labels: string[]
  series: ChartSeries[]
}

export interface Scale {
  min: number
  max: number
  ticks: number[]
}

const list = (text: string) =>
  text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '')

const NUMBER = /[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:e[-+]?\d+)?|[-+]?\.\d+/i

/** Reads the first number in the text, so units and notes around it are ignored. Commas only group thousands. */
const toNumber = (text: string) => {
  const match = text.replace(/\u2212/g, '-').match(NUMBER)
  const n = match ? Number(match[0].replace(/,/g, '')) : NaN
  return Number.isFinite(n) ? n : 0
}

/** Reads `values="1, 2, 3; 4, 5, 6"` (series separated by `;`) with optional labels and series names. */
export function fromValues(values: string, labels = '', names = ''): ChartData {
  const series = values
    .split(';')
    .map((part) => list(part).map(toNumber))
    .filter((part) => part.length)
  const length = Math.max(0, ...series.map((part) => part.length))
  const given = list(labels)
  const named = list(names)
  return {
    labels: Array.from({ length }, (_, i) => given[i] ?? String(i + 1)),
    series: series.map((part, i) => ({
      name: named[i] ?? '',
      values: Array.from({ length }, (_, j) => part[j] ?? 0),
    })),
  }
}

/** Reads a table: the first column holds the labels, every other column is one series. A cell's `data-value` overrides its text. */
export function fromTable(table: HTMLTableElement): ChartData {
  const rows = [...table.rows].map((row) => [...row.cells])
  if (!rows.length) return { labels: [], series: [] }
  const first = rows[0]
  const hasHeader =
    Boolean(table.tHead) ||
    first.every((cell) => cell.localName === 'th') ||
    first.slice(1).every((cell) => !/\d/.test(cell.textContent ?? ''))
  const text = (cell?: HTMLTableCellElement) => cell?.textContent?.trim() ?? ''
  const value = (cell?: HTMLTableCellElement) => toNumber(cell?.dataset.value ?? text(cell))
  const body = hasHeader ? rows.slice(1) : rows
  const width = Math.max(0, ...body.map((row) => row.length))
  return {
    labels: body.map((row) => text(row[0])),
    series: Array.from({ length: Math.max(0, width - 1) }, (_, s) => ({
      name: hasHeader ? text(first[s + 1]) : '',
      values: body.map((row) => value(row[s + 1])),
    })),
  }
}

/** Rounds a value range out to clean tick steps of 1, 2 or 5 times a power of ten. */
export function niceScale(min: number, max: number, count = 4): Scale {
  if (max <= min) max = min + 1
  const raw = (max - min) / count
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const ratio = raw / magnitude
  const step =
    (ratio >= Math.sqrt(50) ? 10 : ratio >= Math.sqrt(10) ? 5 : ratio >= Math.sqrt(2) ? 2 : 1) *
    magnitude
  const lo = Math.floor(min / step + 1e-9) * step
  const hi = Math.ceil(max / step - 1e-9) * step
  const ticks: number[] = []
  for (let k = 0; lo + k * step <= hi + step / 2; k++)
    ticks.push(Number((lo + k * step).toFixed(10)))
  return { min: lo, max: hi, ticks }
}

/** `''`, `'compact'`, `'percent'`, `'currency:EUR'` or `'unit:kilometer'`, formatted with `Intl.NumberFormat`. */
export function formatter(format: string): (value: number) => string {
  const [kind, arg] = format.split(':').map((part) => part.trim())
  const options: Intl.NumberFormatOptions =
    kind === 'compact'
      ? { notation: 'compact' }
      : kind === 'percent'
        ? { style: 'unit', unit: 'percent' }
        : kind === 'currency'
          ? { style: 'currency', currency: arg || 'USD' }
          : kind === 'unit'
            ? { style: 'unit', unit: arg }
            : {}
  try {
    const nf = new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
      trailingZeroDisplay: 'stripIfInteger',
      ...options,
    } as Intl.NumberFormatOptions)
    return (value) => nf.format(value)
  } catch {
    const nf = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })
    return (value) => nf.format(value)
  }
}
