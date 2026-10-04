import { LitElement, svg, css, nothing } from 'lit'
import { property, state } from 'lit/decorators.js'
import { Controllable, PlaybackController } from '../../utils/playback.js'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'
import { useIntersect } from '../../text/utils/use-intersect.js'
import { fromValues } from '../utils/chart-data.js'
import { SpringValues } from '../utils/spring-values.js'
import type { MotionSparklineProps, SparklineTrigger } from './motion-sparkline.types.js'

export type { MotionSparklineProps, SparklineTrigger } from './motion-sparkline.types.js'

const DOT = 2.5
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * A small trend line that sits inside a sentence, a table cell or a stat
 * tile. It draws itself in when it scrolls into view, and springs to new
 * values when `values` changes.
 *
 * **Use it for:** a small trend next to a number, in a sentence, a table cell
 * or a stat tile, where the shape matters more than the exact values.
 *
 * **Avoid it for:** data people need to read exactly or explore. It has no
 * axes, tooltip or keyboard support; use `motion-chart` instead.
 *
 * **Accessibility:** it has `role="img"` and an `aria-label`: your `label`,
 * or a generated summary such as "from 3 to 11, low 3, high 11". The drawing
 * itself is hidden, and the sparkline is not focusable. The summary has no
 * units or context, so set `label`, for example "Signups this week, from 3
 * to 11", when the text nearby does not explain the trend.
 *
 * **Reduced motion:** the line appears in full at once when the draw-in would
 * start (on mount, or when half of it is in view). New values replace the old
 * ones at once.
 *
 * **Common mistakes:** passing fewer than two values: nothing is drawn.
 * Writing thousands separators, such as `1,200`: commas separate values, so
 * it reads as 1 and 200.
 *
 * @element motion-sparkline
 *
 * @fires motion-start - When the draw-in starts.
 * @fires motion-finish - When the draw-in finishes.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
 *
 * @cssprop --sparkline-width - Width. Default `6em`.
 * @cssprop --sparkline-height - Height. Default `1.5em`.
 * @cssprop --sparkline-color - Line color. Default `currentColor`.
 * @cssprop --sparkline-accent - Color of the dot on the last value. Default the line color.
 *
 * @example
 * ```html
 * Signups this week <motion-sparkline values="3, 5, 4, 8, 7, 11"></motion-sparkline>
 * ```
 */
@customElement('motion-sparkline')
export class MotionSparkline extends Controllable(LitElement) implements MotionSparklineProps {
  /** Comma-separated numbers. */
  @property({ type: String }) values = ''
  /** Fills the area under the line with a light wash. */
  @property({ type: Boolean, converter: flag }) area = false
  /** When the draw-in runs: `'view'` (scrolled into view) or `'mount'`. */
  @property({ type: String, reflect: true }) trigger: SparklineTrigger = 'view'
  /** Spring duration in seconds. */
  @property({ type: Number }) duration = 1
  /** Spring bounciness when the values change. */
  @property({ type: Number }) bounce = 0.2
  /** Accessible name. Without it the name describes the trend, for example "from 3 to 11, low 3, high 11". */
  @property({ type: String }) label = ''

  @state() private size = { width: 0, height: 0 }

  static styles = css`
    :host {
      display: inline-block;
      width: var(--sparkline-width, 6em);
      height: var(--sparkline-height, 1.5em);
      vertical-align: middle;
      color: var(--sparkline-color, currentColor);
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .line {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .area {
      fill: currentColor;
      fill-opacity: 0.1;
    }
    .dot {
      fill: var(--sparkline-accent, currentColor);
    }
  `

  private points: number[] = []
  private springs = new SpringValues(() => this.requestUpdate())
  private draw = new SpringValues(() => this.requestUpdate())
  private resizer: ResizeObserver | null = null
  private disconnectIntersect: (() => void) | null = null

  playback: PlaybackController = new PlaybackController(this, {
    start: () => {
      this.springs.set(this.points)
      this.draw.to([1], () => ({ type: 'spring', bounce: 0, duration: this.duration }))
      return {
        handle: {
          pause: () => this.draw.pause(),
          resume: () => this.draw.resume(),
          finish: () => this.draw.set([1]),
          cancel: () => this.draw.stop(),
        },
        done: this.draw.settled(),
      }
    },
    applyFinalState: () => {
      this.springs.set(this.points)
      this.draw.set([1])
    },
    applyInitialState: () => {
      this.springs.set(this.points)
      this.draw.set([0])
    },
  })

  connectedCallback() {
    super.connectedCallback()
    if (this.hasUpdated) this.observe()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.resizer?.disconnect()
    this.disconnectIntersect?.()
    this.disconnectIntersect = null
    this.springs.stop()
    this.draw.stop()
  }

  willUpdate(changed: Map<string, unknown>) {
    if (!changed.has('values')) return
    this.points = fromValues(this.values).series[0]?.values ?? []
    const first = changed.get('values') === undefined
    if (first || this.playState === 'idle') {
      this.springs.set(this.points)
      if (first) this.draw.set([0])
    } else if (reduced()) this.springs.set(this.points)
    else {
      const last = this.springs.current[this.springs.current.length - 1] ?? 0
      this.springs.current = this.points.map((_, i) => this.springs.current[i] ?? last)
      this.springs.to(this.points, () => ({
        type: 'spring',
        duration: this.duration * 0.6,
        bounce: this.bounce,
      }))
    }
  }

  firstUpdated() {
    this.observe()
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('trigger') && changed.get('trigger') !== undefined) this.arm()
    if (changed.has('label') || changed.has('values')) this.describe()
  }

  /** Draws the line in again. */
  replay() {
    this.cancel()
    void this.play()
  }

  private observe() {
    if (this.playState === 'idle') this.draw.set([0])
    this.resizer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      this.size = { width, height }
    })
    this.resizer.observe(this)
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
    this.disconnectIntersect = useIntersect(this, 0.5, () => {
      this.disconnectIntersect?.()
      this.disconnectIntersect = null
      void this.play()
    })
  }

  private describe() {
    const p = this.points
    const name = p.length
      ? `from ${p[0]} to ${p[p.length - 1]}, low ${Math.min(...p)}, high ${Math.max(...p)}`
      : ''
    this.setAttribute('role', 'img')
    this.setAttribute('aria-label', this.label || name)
  }

  render() {
    const values = this.springs.current
    const { width, height } = this.size
    if (values.length < 2 || !width) return nothing
    const lo = Math.min(...this.points)
    const hi = Math.max(...this.points)
    const span = hi - lo || 1
    const x = (i: number) => DOT + ((width - DOT * 2) * i) / (values.length - 1)
    const y = (v: number) => DOT + (height - DOT * 2) * (1 - (v - lo) / span)
    const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v)}`).join('')
    const draw = this.draw.current[0] ?? 1
    const end = values.length - 1
    return svg`<svg aria-hidden="true">
      ${
        this.area
          ? svg`<path class="area" opacity=${draw} d=${`${line}L${x(end)} ${height}L${x(0)} ${height}Z`} />`
          : nothing
      }
      <path class="line" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset=${1 - draw} d=${line} />
      ${draw >= 0.99 ? svg`<circle class="dot" r=${DOT} cx=${x(end)} cy=${y(values[end])} />` : nothing}
    </svg>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-sparkline': MotionSparkline
  }
}
