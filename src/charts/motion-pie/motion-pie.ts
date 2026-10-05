import { LitElement, html, svg, css, nothing } from 'lit'
import { property, state } from 'lit/decorators.js'
import { animate } from 'motion'
import { Controllable, PlaybackController } from '../../utils/playback.js'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'
import { useIntersect } from '../../text/utils/use-intersect.js'
import { formatter, fromTable, fromValues } from '../utils/chart-data.js'
import { SpringValues } from '../utils/spring-values.js'
import { chartStyles, seriesColor } from '../utils/chart-styles.js'
import type { MotionPieProps, PieData, PieTrigger } from './motion-pie.types.js'

export type { MotionPieProps, PieData, PieTrigger } from './motion-pie.types.js'

const MAX_SLICES = 6
const POP = 8

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function arcPath(cx: number, cy: number, r: number, inner: number, a0: number, a1: number) {
  const span = Math.min(a1 - a0, Math.PI * 2 - 1e-4)
  if (span <= 0) return ''
  const end = a0 + span
  const p = (a: number, radius: number) =>
    `${cx + radius * Math.sin(a)} ${cy - radius * Math.cos(a)}`
  const large = span > Math.PI ? 1 : 0
  const outer = `M${p(a0, r)}A${r} ${r} 0 ${large} 1 ${p(end, r)}`
  return inner
    ? `${outer}L${p(end, inner)}A${inner} ${inner} 0 ${large} 0 ${p(a0, inner)}Z`
    : `${outer}L${cx} ${cy}Z`
}

/**
 * A pie or donut chart for parts of a whole. Pass numbers in `values`, wrap
 * a `<table>` (labels in the first column, values in the second), or set
 * `data` from JavaScript. The pie sweeps in when it scrolls into view, the
 * slices spring to new sizes when the data changes, and the hovered slice
 * springs outward. More than six slices are combined into "Other".
 *
 * **Use it for:** showing how a total splits into a few parts, such as
 * traffic sources or a budget, with six slices or fewer.
 *
 * **Avoid it for:** values that are not parts of one whole, values over time,
 * or many categories; use `motion-chart`.
 *
 * **Accessibility:** the drawing is hidden from screen readers, which read a
 * visually hidden data table instead: your own `<table>`, or one built from
 * `values` or `data` that lists each label, value and share, with `label` as
 * its caption. The plot is a focusable group with the role description
 * "pie chart" and `label` as its name. The arrow keys move between slices,
 * Home and End jump to the first and last, Escape clears the selection, and a
 * polite live region announces each slice with its value and share. Set
 * `label`.
 *
 * **Reduced motion:** the whole pie appears at once when the sweep-in would
 * start (on mount, or when 30% of it is in view). New values, the hovered
 * slice and the tooltip change at once, without springs.
 *
 * **Common mistakes:** passing negative values: they are drawn as 0. Passing
 * more than six items: the sixth item and all after it are merged into one
 * slice labeled "Other", so group small items yourself to choose the label.
 *
 * @element motion-pie
 *
 * @slot - An optional `<table>` with the data. It stays available to screen readers.
 *
 * @fires motion-start - When the sweep-in starts.
 * @fires motion-finish - When the sweep-in finishes.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
 *
 * @cssprop --mc-chart-height - Height of the chart, including the legend. Default `16rem`.
 * @cssprop --mc-chart-1 - Color of the first slice. `--mc-chart-2` to `--mc-chart-6` color the others.
 * @cssprop --mc-chart-surface - Background behind the chart, used for the gap between slices. Default `Canvas`.
 *
 * @csspart legend - The legend.
 * @csspart tooltip - The tooltip.
 *
 * @example
 * ```html
 * <motion-pie values="42, 28, 18, 12" labels="Direct, Search, Social, Email"></motion-pie>
 * ```
 */
@customElement('motion-pie')
export class MotionPie extends Controllable(LitElement) implements MotionPieProps {
  /** Comma-separated numbers, one per slice. Ignored when a `<table>` or `data` is given. */
  @property({ type: String }) values = ''
  /** Comma-separated slice labels. */
  @property({ type: String }) labels = ''
  /** Data from JavaScript: `{ labels, values }`. Takes precedence over a table and `values`. */
  @property({ attribute: false }) data: PieData | null = null
  /** Cuts out the center and shows the total there. */
  @property({ type: Boolean, converter: flag, reflect: true }) donut = false
  /** Number format: `'compact'`, `'percent'`, `'currency:EUR'` or `'unit:kilometer'`. */
  @property({ type: String }) format = ''
  /** Caption under the total in a donut. */
  @property({ type: String, attribute: 'total-label' }) totalLabel = 'Total'
  /** When the sweep-in runs: `'view'` (scrolled into view) or `'mount'`. */
  @property({ type: String, reflect: true }) trigger: PieTrigger = 'view'
  /** Spring duration in seconds. */
  @property({ type: Number }) duration = 0.8
  /** Spring bounciness when the values change (0 = no overshoot). */
  @property({ type: Number }) bounce = 0.25
  /** Shows a tooltip on hover and keyboard focus. A donut shows the hovered slice in its center instead. Set `tooltip="false"` to hide it. */
  @property({ type: Boolean, converter: flag }) tooltip = true
  /** Shows a legend with each share. Set `legend="false"` to hide it. */
  @property({ type: Boolean, converter: flag }) legend = true
  /** Accessible name of the chart. */
  @property({ type: String }) label = ''

  @state() private model: PieData = { labels: [], values: [] }
  @state() private active = -1
  @state() private size = { width: 0, height: 0 }

  static styles = [
    chartStyles,
    css`
      .slice {
        stroke: var(--mc-chart-surface, Canvas);
        stroke-width: 2;
        stroke-linejoin: round;
      }
      .center-value {
        fill: currentColor;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .center-label {
        fill: var(--mc-chart-muted);
      }
    `,
  ]

  private springs = new SpringValues(() => this.requestUpdate())
  private sweep = new SpringValues(() => this.requestUpdate())
  private pops = new SpringValues(() => this.requestUpdate())
  private fmt = formatter('')
  private percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 })
  private announcement = ''
  private tipShown = false
  private resizer: ResizeObserver | null = null
  private mutations: MutationObserver | null = null
  private disconnectIntersect: (() => void) | null = null

  playback: PlaybackController = new PlaybackController(this, {
    start: () => {
      this.springs.set(this.model.values)
      this.sweep.to([1], () => ({ type: 'spring', bounce: 0, duration: this.duration * 1.6 }))
      return {
        handle: {
          pause: () => this.sweep.pause(),
          resume: () => this.sweep.resume(),
          finish: () => this.sweep.set([1]),
          cancel: () => this.sweep.stop(),
        },
        done: this.sweep.settled(),
      }
    },
    applyFinalState: () => {
      this.springs.set(this.model.values)
      this.sweep.set([1])
    },
    applyInitialState: () => {
      this.springs.set(this.model.values)
      this.sweep.set([0])
    },
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
    this.sweep.stop()
    this.pops.stop()
  }

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has('format')) this.fmt = formatter(this.format)
    if (['values', 'labels', 'data'].some((key) => changed.has(key))) this.retarget()
  }

  firstUpdated() {
    this.observe()
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('trigger') && changed.get('trigger') !== undefined) this.arm()
    if (changed.has('active') || changed.has('size')) this.placeTip()
  }

  /** Sweeps the pie in again. */
  replay() {
    this.cancel()
    void this.play()
  }

  private readData(): PieData {
    const table = this.querySelector('table')
    const source = table ? fromTable(table) : fromValues(this.values, this.labels)
    const data = this.data ?? { labels: source.labels, values: source.series[0]?.values ?? [] }
    const values = data.labels.map((_, i) => Math.max(0, data.values[i] ?? 0))
    if (data.labels.length <= MAX_SLICES) return { labels: data.labels, values }
    const keep = MAX_SLICES - 1
    return {
      labels: [...data.labels.slice(0, keep), 'Other'],
      values: [...values.slice(0, keep), values.slice(keep).reduce((a, b) => a + b, 0)],
    }
  }

  private retarget() {
    const next = this.readData()
    this.springs.current = next.values.map((_, i) => this.springs.current[i] ?? 0)
    this.model = next
    if (this.active >= next.labels.length) this.active = -1
    if (this.playState === 'idle') {
      this.springs.set(next.values)
      this.sweep.set([0])
    } else if (reduced()) this.springs.set(next.values)
    else
      this.springs.to(next.values, () => ({
        type: 'spring',
        duration: this.duration,
        bounce: this.bounce,
      }))
  }

  private observe() {
    if (this.playState === 'idle') this.sweep.set([0])
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

  private get total() {
    return this.model.values.reduce((a, b) => a + b, 0)
  }

  private share(i: number) {
    return this.percent.format((this.model.values[i] ?? 0) / (this.total || 1))
  }

  private geometry() {
    const { width, height } = this.size
    const r = Math.max(0, Math.min(width, height) / 2 - POP - 2)
    return { cx: width / 2, cy: height / 2, r, inner: this.donut ? r * 0.62 : 0 }
  }

  private angles() {
    const values = this.springs.current.map((v) => Math.max(0, v ?? 0))
    const total = values.reduce((a, b) => a + b, 0) || 1
    const sweep = Math.PI * 2 * (this.sweep.current[0] ?? 1)
    let start = 0
    return values.map((v) => {
      const a0 = start
      start += (v / total) * sweep
      return [a0, start] as const
    })
  }

  private sliceAt(x: number, y: number) {
    const g = this.geometry()
    const dx = x - g.cx
    const dy = y - g.cy
    const distance = Math.hypot(dx, dy)
    if (distance > g.r + POP || distance < g.inner) return -1
    const angle = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2)
    return this.angles().findIndex(([a0, a1]) => angle >= a0 && angle < a1)
  }

  private renderPie() {
    const { labels, values } = this.model
    if (!this.size.width || !labels.length) return nothing
    const g = this.geometry()
    const a = this.active
    return svg`<svg aria-hidden="true">
      ${this.angles().map(([a0, a1], i) => {
        const mid = (a0 + a1) / 2
        const offset = (this.pops.current[i] ?? 0) * POP
        return svg`<path class="slice" fill=${seriesColor(i)} opacity=${a >= 0 && a !== i ? 0.7 : 1}
          transform=${`translate(${Math.sin(mid) * offset} ${-Math.cos(mid) * offset})`}
          d=${arcPath(g.cx, g.cy, g.r, g.inner, a0, a1)} />`
      })}
      ${
        g.inner
          ? svg`<text class="center-value" x=${g.cx} y=${g.cy} text-anchor="middle" font-size=${g.inner * 0.36}>${this.fmt(a >= 0 ? values[a] : this.total)}</text>
            <text class="center-label" x=${g.cx} y=${g.cy + g.inner * 0.3} text-anchor="middle" font-size=${Math.max(11, g.inner * 0.15)}>${a >= 0 ? labels[a] : this.totalLabel}</text>`
          : nothing
      }
    </svg>`
  }

  private renderTip() {
    const a = Math.max(0, this.active)
    return html`<div class="tip" part="tooltip">
      <div class="tip-label">${this.model.labels[a]}</div>
      <div class="row" style=${`--mc-chart-series:${seriesColor(a)}`}>
        <i></i><strong>${this.fmt(this.model.values[a] ?? 0)}</strong>${this.format === 'percent'
          ? nothing
          : html`<span>${this.share(a)}</span>`}
      </div>
    </div>`
  }

  private renderTable() {
    return html`<table>
      ${this.label ? html`<caption>${this.label}</caption>` : nothing}
      ${this.model.labels.map(
        (label, i) =>
          html`<tr>
            <th>${label}</th>
            <td>${this.fmt(this.model.values[i] ?? 0)}</td>
            <td>${this.share(i)}</td>
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
    const g = this.geometry()
    const [a0, a1] = this.angles()[this.active] ?? [0, 0]
    const mid = (a0 + a1) / 2
    const w = tip.offsetWidth
    const h = tip.offsetHeight
    const px = g.cx + Math.sin(mid) * (g.r + 14)
    const py = g.cy - Math.cos(mid) * (g.r + 14)
    const x = Math.min(
      Math.max(0, Math.sin(mid) >= 0 ? px : px - w),
      Math.max(0, this.size.width - w),
    )
    const y = Math.min(Math.max(0, py - h / 2), Math.max(0, this.size.height - h))
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
    const goal = this.model.labels.map((_, i) => (i === this.active ? 1 : 0))
    if (reduced()) this.pops.set(goal)
    else this.pops.to(goal, () => ({ type: 'spring', duration: 0.4, bounce: 0.45 }))
    if (this.active < 0) return
    const value = this.fmt(this.model.values[this.active] ?? 0)
    this.announcement = `${this.model.labels[this.active]}: ${value}, ${this.share(this.active)}`
  }

  private onPointerMove = (e: PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const index = this.sliceAt(e.clientX - rect.left, e.clientY - rect.top)
    if (index !== this.active) this.setActive(index)
  }

  private onPointerLeave = () => this.setActive(-1)

  private onKeyDown = (e: KeyboardEvent) => {
    const last = this.model.labels.length - 1
    const moves: Record<string, number> = {
      ArrowRight: Math.min(last, this.active + 1),
      ArrowDown: Math.min(last, this.active + 1),
      ArrowLeft: Math.max(0, this.active - 1),
      ArrowUp: Math.max(0, this.active - 1),
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
    const { labels } = this.model
    const hasTable = Boolean(this.querySelector('table'))
    return html`<div class="frame">
      ${this.legend && labels.length > 1
        ? html`<div class="legend" part="legend">
            ${labels.map(
              (name, i) =>
                html`<span class="key"
                  ><span class="swatch" style=${`--mc-chart-series:${seriesColor(i)}`}></span
                  >${name}<span class="share">${this.share(i)}</span></span
                >`,
            )}
          </div>`
        : nothing}
      <div
        class="plot"
        tabindex="0"
        role="group"
        aria-roledescription="pie chart"
        aria-label=${this.label || nothing}
        @pointermove=${this.onPointerMove}
        @pointerleave=${this.onPointerLeave}
        @keydown=${this.onKeyDown}
        @focus=${this.onFocus}
        @blur=${this.onPointerLeave}
      >
        ${this.renderPie()} ${this.tooltip && !this.donut ? this.renderTip() : nothing}
      </div>
      <div class="sr-only" aria-live="polite">${this.announcement}</div>
      <div class="sr-only"><slot></slot>${hasTable ? nothing : this.renderTable()}</div>
    </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-pie': MotionPie
  }
}
