import { LitElement, html, svg, css, nothing } from 'lit'
import { property, state } from 'lit/decorators.js'
import { animate } from 'motion'
import { Controllable, PlaybackController } from '../../utils/playback.js'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'
import { useIntersect } from '../../text/utils/use-intersect.js'
import { formatter, fromTable, fromValues, niceScale } from '../utils/chart-data.js'
import type { ChartData } from '../utils/chart-data.js'
import { SpringValues } from '../utils/spring-values.js'
import { chartStyles, seriesColor } from '../utils/chart-styles.js'
import type { ChartTrigger, ChartType, MotionChartProps } from './motion-chart.types.js'

export type {
  ChartData,
  ChartSeries,
  ChartTrigger,
  ChartType,
  MotionChartProps,
} from './motion-chart.types.js'

const MAX_SERIES = 8
const BAR_MAX = 24
const GAP = 2
const RADIUS = 4
const CHAR = 6.5
const PAD = { top: 10, right: 8, bottom: 24 }

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function barPath(x: number, width: number, base: number, end: number) {
  const r = Math.min(RADIUS, width / 2, Math.abs(base - end))
  const dir = end < base ? 1 : -1
  return `M${x} ${base}V${end + dir * r}Q${x} ${end} ${x + r} ${end}H${x + width - r}Q${x + width} ${end} ${x + width} ${end + dir * r}V${base}Z`
}

/**
 * A bar or line chart drawn from HTML. Pass numbers in `values`, wrap a
 * `<table>` (first column labels, one series per column), or set `data` from
 * JavaScript. Bars grow and lines draw in when the chart scrolls into view.
 * When the data changes, every bar and point springs to its new value, and a
 * change in the middle of an animation continues from where the chart is.
 *
 * @element motion-chart
 *
 * @slot - An optional `<table>` with the data. It stays available to screen readers.
 *
 * @fires motion-start - When the entrance animation starts.
 * @fires motion-finish - When the entrance animation finishes.
 *
 * @cssprop --chart-height - Height of the chart, including the legend. Default `16rem`.
 * @cssprop --chart-1 - Color of the first series. `--chart-2` to `--chart-8` color the others.
 * @cssprop --chart-surface - Background behind the chart, used for the ring around points. Default `Canvas`.
 *
 * @csspart legend - The legend, shown for two or more series.
 * @csspart tooltip - The tooltip.
 *
 * @example
 * ```html
 * <motion-chart type="bar" values="12, 19, 8, 24" labels="Mon, Tue, Wed, Thu"></motion-chart>
 * ```
 */
@customElement('motion-chart')
export class MotionChart extends Controllable(LitElement) implements MotionChartProps {
  /** `'bar'` or `'line'`. */
  @property({ type: String, reflect: true }) type: ChartType = 'bar'
  /** Comma-separated numbers. Separate several series with `;`. Ignored when a `<table>` or `data` is given. */
  @property({ type: String }) values = ''
  /** Comma-separated labels for the `values`. */
  @property({ type: String }) labels = ''
  /** Comma-separated series names for the `values`. */
  @property({ type: String }) series = ''
  /** Data from JavaScript: `{ labels, series: [{ name, values }] }`. Takes precedence over a table and `values`. */
  @property({ attribute: false }) data: ChartData | null = null
  /** Lowest value on the axis. Defaults to the lower of `0` and the smallest value. */
  @property({ type: Number }) min = NaN
  /** Highest value on the axis. Defaults to the largest value, rounded up. */
  @property({ type: Number }) max = NaN
  /** Number format: `'compact'`, `'percent'`, `'currency:EUR'` or `'unit:kilometer'`. */
  @property({ type: String }) format = ''
  /** When the entrance runs: `'view'` (scrolled into view) or `'mount'`. */
  @property({ type: String, reflect: true }) trigger: ChartTrigger = 'view'
  /** Spring duration in seconds. */
  @property({ type: Number }) duration = 0.8
  /** Spring bounciness (0 = no overshoot). */
  @property({ type: Number }) bounce = 0.25
  /** Seconds between one bar group and the next on entrance. */
  @property({ type: Number }) interval = 0.04
  /** Shows a tooltip on hover and keyboard focus. Set `tooltip="false"` to hide it. */
  @property({ type: Boolean, converter: flag }) tooltip = true
  /** Shows a legend for two or more series. Set `legend="false"` to hide it. */
  @property({ type: Boolean, converter: flag }) legend = true
  /** Accessible name of the chart. */
  @property({ type: String }) label = ''

  @state() private model: ChartData = { labels: [], series: [] }
  @state() private active = -1
  @state() private size = { width: 0, height: 0 }

  static styles = [
    chartStyles,
    css`
      .swatch.line {
        height: 2px;
        width: 14px;
        border-radius: 1px;
      }
      .grid {
        stroke: var(--_grid);
        shape-rendering: crispEdges;
      }
      .tick {
        fill: var(--_muted);
        font-size: 11px;
        font-variant-numeric: tabular-nums;
      }
      .series-line {
        fill: none;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .point {
        stroke: var(--chart-surface, Canvas);
        stroke-width: 2;
      }
      .crosshair {
        stroke: color-mix(in srgb, currentColor 35%, transparent);
      }
    `,
  ]

  private springs = new SpringValues(() => this.requestUpdate())
  private draw = new SpringValues(() => this.requestUpdate())
  private domain = new SpringValues(() => this.requestUpdate())
  private fmt = formatter('')
  private announcement = ''
  private tipShown = false
  private resizer: ResizeObserver | null = null
  private mutations: MutationObserver | null = null
  private disconnectIntersect: (() => void) | null = null

  playback: PlaybackController = new PlaybackController(this, {
    start: () => {
      if (this.type === 'bar') {
        this.draw.set([1])
        this.springs.to(this.targets(), (i) => ({
          ...this.spring(),
          delay: (i % Math.max(1, this.model.labels.length)) * this.interval,
        }))
      } else {
        this.springs.set(this.targets())
        this.draw.to([1], () => ({ type: 'spring', bounce: 0, duration: this.duration * 1.6 }))
      }
      return {
        handle: {
          pause: () => (this.springs.pause(), this.draw.pause()),
          resume: () => (this.springs.resume(), this.draw.resume()),
          finish: () => this.showFinal(),
          cancel: () => (this.springs.stop(), this.draw.stop()),
        },
        done: Promise.all([this.springs.settled(), this.draw.settled()]),
      }
    },
    applyFinalState: () => this.showFinal(),
    applyInitialState: () => this.showInitial(),
  })

  connectedCallback() {
    super.connectedCallback()
    this.mutations = new MutationObserver(() => this.retarget())
    this.mutations.observe(this, { childList: true, subtree: true, characterData: true })
    if (this.hasUpdated) this.observe()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.mutations?.disconnect()
    this.resizer?.disconnect()
    this.disconnectIntersect?.()
    this.disconnectIntersect = null
    this.springs.stop()
    this.draw.stop()
    this.domain.stop()
  }

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has('format')) this.fmt = formatter(this.format)
    if (['values', 'labels', 'series', 'data', 'min', 'max'].some((key) => changed.has(key)))
      this.retarget()
    if (changed.has('type')) {
      if (this.playState === 'idle') this.showInitial()
      else this.showFinal()
    }
  }

  firstUpdated() {
    this.observe()
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('trigger') && changed.get('trigger') !== undefined) this.arm()
    if (changed.has('active') || changed.has('size')) this.placeTip()
  }

  /** Restarts the entrance animation. */
  replay() {
    this.cancel()
    void this.play()
  }

  private spring() {
    return { type: 'spring' as const, duration: this.duration, bounce: this.bounce }
  }

  private readData(): ChartData {
    const table = this.querySelector('table')
    const data =
      this.data ?? (table ? fromTable(table) : fromValues(this.values, this.labels, this.series))
    return { labels: data.labels, series: data.series.slice(0, MAX_SERIES) }
  }

  private targets(model = this.model) {
    return model.series.flatMap((s) => model.labels.map((_, i) => s.values[i] ?? 0))
  }

  private retarget() {
    const before = this.model
    const next = this.readData()
    const n = before.labels.length
    const m = next.labels.length
    this.springs.current = next.series.flatMap((_, s) =>
      next.labels.map((_, i) => {
        const old = s < before.series.length ? this.springs.current[s * n + Math.min(i, n - 1)] : 0
        return i < n || this.type === 'line' ? (old ?? 0) : 0
      }),
    )
    this.model = next
    if (this.active >= m) this.active = -1
    const targets = this.targets(next)
    const { min, max } = this.scale()
    if (this.playState === 'idle') this.showInitial()
    else if (reduced()) {
      this.springs.set(targets)
      this.domain.set([min, max])
    } else {
      this.springs.to(targets, () => this.spring())
      this.domain.to([min, max], () => ({ ...this.spring(), bounce: 0 }))
    }
  }

  private showInitial() {
    const targets = this.targets()
    const { min, max } = this.scale()
    this.domain.set([min, max])
    if (this.type === 'bar') {
      this.springs.set(targets.map(() => 0))
      this.draw.set([1])
    } else {
      this.springs.set(targets)
      this.draw.set([0])
    }
  }

  private showFinal() {
    const { min, max } = this.scale()
    this.domain.set([min, max])
    this.springs.set(this.targets())
    this.draw.set([1])
  }

  private observe() {
    if (this.playState === 'idle') this.showInitial()
    const plot = this.renderRoot.querySelector<HTMLElement>('.plot')!
    this.resizer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      this.size = { width, height }
    })
    this.resizer.observe(plot)
    this.arm()
  }

  private arm() {
    this.disconnectIntersect?.()
    this.disconnectIntersect = null
    if (this.playState !== 'idle') return
    if (this.trigger === 'mount') {
      void this.play()
      return
    }
    this.disconnectIntersect = useIntersect(this, 0.3, () => {
      this.disconnectIntersect?.()
      this.disconnectIntersect = null
      void this.play()
    })
  }

  private scale() {
    const values = this.targets()
    const lo = Number.isNaN(this.min) ? Math.min(0, ...values) : this.min
    const hi = Number.isNaN(this.max) ? Math.max(0, ...values) : this.max
    return niceScale(lo, hi)
  }

  private layout() {
    const { labels } = this.model
    const scale = this.scale()
    const [low, high] =
      this.domain.current.length === 2 ? this.domain.current : [scale.min, scale.max]
    const left = Math.max(...scale.ticks.map((t) => this.fmt(t).length)) * CHAR + 10
    const plotW = Math.max(0, this.size.width - left - PAD.right)
    const plotH = Math.max(0, this.size.height - PAD.top - PAD.bottom)
    const span = high - low || 1
    const band = labels.length ? plotW / labels.length : 0
    return {
      scale,
      left,
      plotW,
      plotH,
      band,
      y: (v: number) => PAD.top + plotH * (1 - (v - low) / span),
      x: (i: number) => left + band * (i + 0.5),
    }
  }

  private value(s: number, i: number) {
    return this.springs.current[s * this.model.labels.length + i] ?? 0
  }

  private target(s: number, i: number) {
    return this.model.series[s]?.values[i] ?? 0
  }

  private renderChart() {
    const { labels, series } = this.model
    if (!this.size.width || !labels.length) return nothing
    const L = this.layout()
    const base = L.y(Math.max(L.scale.min, Math.min(0, L.scale.max)))
    const widest = Math.max(...labels.map((l) => l.length)) * CHAR + 12
    const every = Math.max(1, Math.ceil(labels.length / Math.max(1, Math.floor(L.plotW / widest))))
    const k = series.length
    const barW = Math.max(1, Math.min(BAR_MAX, (L.band * 0.8 - GAP * (k - 1)) / k))
    const groupW = k * barW + (k - 1) * GAP
    const draw = this.draw.current[0] ?? 1
    const a = this.active

    const plotBottom = PAD.top + L.plotH
    return svg`<svg aria-hidden="true">
      <defs><clipPath id="plot"><rect x="0" y="0" width=${this.size.width} height=${plotBottom} /></clipPath></defs>
      ${L.scale.ticks
        .filter((t) => L.y(t) >= PAD.top - 1 && L.y(t) <= plotBottom + 1)
        .map(
          (
            t,
          ) => svg`<line class="grid" x1=${L.left} x2=${L.left + L.plotW} y1=${L.y(t)} y2=${L.y(t)} />
          <text class="tick" x=${L.left - 8} y=${L.y(t)} text-anchor="end" dominant-baseline="middle">${this.fmt(t)}</text>`,
        )}
      ${labels.map((label, i) =>
        i % every
          ? nothing
          : svg`<text class="tick" x=${L.x(i)} y=${PAD.top + L.plotH + 16} text-anchor="middle">${label}</text>`,
      )}
      ${
        this.type === 'line' && a >= 0
          ? svg`<line class="crosshair" x1=${L.x(a)} x2=${L.x(a)} y1=${PAD.top} y2=${PAD.top + L.plotH} />`
          : nothing
      }
      <g clip-path="url(#plot)">${series.map((_, s) =>
        this.type === 'bar'
          ? labels.map(
              (_, i) =>
                svg`<path fill=${seriesColor(s)} opacity=${a >= 0 && a !== i ? 0.45 : 1}
                  d=${barPath(L.x(i) - groupW / 2 + s * (barW + GAP), barW, base, L.y(this.value(s, i)))} />`,
            )
          : svg`<path class="series-line" stroke=${seriesColor(s)} pathLength="1" stroke-dasharray="1 1"
                stroke-dashoffset=${1 - draw}
                d=${labels.map((_, i) => `${i ? 'L' : 'M'}${L.x(i)} ${L.y(this.value(s, i))}`).join('')} />
              ${[draw >= 0.99 ? labels.length - 1 : -1, a]
                .filter((i, j, all) => i >= 0 && all.indexOf(i) === j)
                .map(
                  (i) =>
                    svg`<circle class="point" fill=${seriesColor(s)} r="4" cx=${L.x(i)} cy=${L.y(this.value(s, i))} />`,
                )}`,
      )}</g>
      <rect x=${L.left} y=${PAD.top} width=${L.plotW} height=${L.plotH} fill="transparent" />
    </svg>`
  }

  private renderTip() {
    const { labels, series } = this.model
    const a = Math.max(0, this.active)
    return html`<div class="tip" part="tooltip">
      <div class="tip-label">${labels[a]}</div>
      ${series.map(
        (s, i) =>
          html`<div class="row" style=${`--c:${seriesColor(i)}`}>
            <i></i><strong>${this.fmt(this.target(i, a))}</strong>${s.name
              ? html`<span>${s.name}</span>`
              : nothing}
          </div>`,
      )}
    </div>`
  }

  private renderTable() {
    const { labels, series } = this.model
    return html`<table>
      ${this.label ? html`<caption>${this.label}</caption>` : nothing}
      <tr>
        <th></th>
        ${series.map((s) => html`<th>${s.name || 'Value'}</th>`)}
      </tr>
      ${labels.map(
        (label, i) =>
          html`<tr>
            <th>${label}</th>
            ${series.map((_, s) => html`<td>${this.fmt(this.target(s, i))}</td>`)}
          </tr>`,
      )}
    </table>`
  }

  private placeTip() {
    const tip = this.renderRoot.querySelector<HTMLElement>('.tip')
    if (!tip) return
    if (this.active < 0) {
      if (this.tipShown) animate(tip, { opacity: 0 }, { duration: 0.15 })
      this.tipShown = false
      return
    }
    const L = this.layout()
    const peak = Math.max(
      ...this.model.series.map((_, s) => this.target(s, this.active)),
      L.scale.min,
    )
    const w = tip.offsetWidth
    const h = tip.offsetHeight
    const cx = L.x(this.active)
    const above = L.y(peak) - h - 12
    const side = cx + L.band / 2 + w <= this.size.width ? cx + L.band / 2 : cx - L.band / 2 - w
    const x =
      above >= 0
        ? Math.min(Math.max(0, cx - w / 2), Math.max(0, this.size.width - w))
        : Math.max(0, side)
    const y = above >= 0 ? above : PAD.top
    if (!this.tipShown || reduced()) {
      animate(tip, { x, y }, { duration: 0 })
      animate(tip, { opacity: 1 }, { duration: reduced() ? 0 : 0.15 })
    } else {
      animate(tip, { x, y }, { type: 'spring', duration: 0.35, bounce: 0.15 })
    }
    this.tipShown = true
  }

  private setActive(index: number) {
    const n = this.model.labels.length
    this.active = n ? Math.max(-1, Math.min(n - 1, index)) : -1
    if (this.active < 0) return
    const rows = this.model.series.map(
      (s, i) => `${s.name ? `${s.name} ` : ''}${this.fmt(this.target(i, this.active))}`,
    )
    this.announcement = `${this.model.labels[this.active]}: ${rows.join(', ')}`
  }

  private onPointerMove = (e: PointerEvent) => {
    const L = this.layout()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left - L.left
    if (x < 0 || x > L.plotW || !L.band) return this.setActive(-1)
    this.setActive(Math.floor(x / L.band))
  }

  private onPointerLeave = () => this.setActive(-1)

  private onKeyDown = (e: KeyboardEvent) => {
    const last = this.model.labels.length - 1
    const moves: Record<string, number> = {
      ArrowRight: Math.min(last, this.active + 1),
      ArrowLeft: Math.max(0, this.active - 1),
      Home: 0,
      End: last,
      Escape: -1,
    }
    if (!(e.key in moves)) return
    e.preventDefault()
    this.setActive(moves[e.key])
  }

  private onFocus = (e: FocusEvent) => {
    if ((e.currentTarget as HTMLElement).matches(':focus-visible') && this.active < 0)
      this.setActive(0)
  }

  render() {
    const { series } = this.model
    const hasTable = Boolean(this.querySelector('table'))
    return html`<div class="frame">
      ${this.legend && series.length > 1
        ? html`<div class="legend" part="legend">
            ${series.map(
              (s, i) =>
                html`<span class="key"
                  ><span class="swatch ${this.type}" style=${`--c:${seriesColor(i)}`}></span
                  >${s.name}</span
                >`,
            )}
          </div>`
        : nothing}
      <div
        class="plot"
        tabindex="0"
        role="group"
        aria-roledescription="chart"
        aria-label=${this.label || nothing}
        @pointermove=${this.onPointerMove}
        @pointerleave=${this.onPointerLeave}
        @keydown=${this.onKeyDown}
        @focus=${this.onFocus}
        @blur=${this.onPointerLeave}
      >
        ${this.renderChart()} ${this.tooltip ? this.renderTip() : nothing}
      </div>
      <div class="sr-only" aria-live="polite">${this.announcement}</div>
      <div class="sr-only"><slot></slot>${hasTable ? nothing : this.renderTable()}</div>
    </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-chart': MotionChart
  }
}
