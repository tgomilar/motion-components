import { LitElement, html, css } from 'lit'
import { property } from 'lit/decorators.js'
import { animate, scroll, GroupAnimationWithThen } from 'motion'
import { LoopCycle, LoopTrigger, pauseOnHover } from '../utils/loop.js'
import type { LoopProps } from '../utils/loop.js'
import { Controllable, PlaybackController, controlsRun } from '../../utils/playback.js'
import type { MotionFontProps, FontTrigger } from './motion-font.types.js'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'

export type { MotionFontProps, FontTrigger } from './motion-font.types.js'

let _instanceCount = 0

interface AxisDef {
  axis: string
  from: number
  to: number
  prop: string
}

/**
 * Animated variable-font axes. Smoothly interpolates one or more variation
 * axes (weight, slant, optical size, custom axes…) between `from` and `to`,
 * triggered by viewport entry, hover, or scroll progress.
 *
 * Uses `CSS.registerProperty` to enable interpolation of `<number>` custom
 * properties, then drives `font-variation-settings` from those properties.
 *
 * **Use it for:** headings, links and labels in a variable font whose weight,
 * slant or width changes when they scroll into view, on hover or focus, or
 * with scroll progress.
 *
 * **Avoid it for:** fonts that are not variable fonts, or that do not have the
 * axis you set, because nothing changes. To scale or move an element on
 * hover, use `motion-hover`.
 *
 * **Accessibility:** the slotted text stays real text, so screen readers read
 * it as normal. With `trigger="hover"`, focus on a focusable element inside,
 * such as a link, also starts the change; the element itself does not take
 * focus. A change in weight or width can change the text width and move the
 * text around it.
 *
 * **Reduced motion:** with `trigger="view"` or `trigger="scroll"`, the axes
 * are set to their `to` values at once and do not follow the scroll. With
 * `trigger="hover"`, the axes switch between `from` and `to` at once, with no
 * transition.
 *
 * **Common mistakes:** changing `axis`, `axes`, `from`, `to` or `trigger`
 * after the element first renders. The setup reads them once, so set them in
 * the markup. Setting both `axes` and `axis`: `axes` wins, and `axis`, `from`
 * and `to` are ignored.
 *
 * @element motion-font
 *
 * @fires motion-start - When a run starts.
 * @fires motion-finish - When a run finishes, or `finish()` jumps to the end.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
 *
 * @slot - The text whose font axes will animate.
 *
 * @example
 * ```html
 * <motion-font axis="wght" from="300" to="800" trigger="hover">
 *   Variable font
 * </motion-font>
 *
 * <motion-font axes="wght:300:800 slnt:0:-12" trigger="scroll">
 *   Multi-axis on scroll
 * </motion-font>
 * ```
 */
@customElement('motion-font')
export class MotionFont extends Controllable(LitElement) implements MotionFontProps, LoopProps {
  /** Single-axis tag to animate (e.g. `'wght'`, `'slnt'`, `'opsz'`). Ignored if `axes` is set. */
  @property({ type: String }) axis = 'wght'
  /** Multi-axis spec: space-separated `axis:from:to` triples. Overrides `axis`/`from`/`to`. */
  @property({ type: String }) axes = ''
  /** Single-axis start value. */
  @property({ type: Number }) from = 300
  /** Single-axis end value. */
  @property({ type: Number }) to = 700
  /** Spring duration of the axis transition, in seconds. */
  @property({ type: Number }) duration = 0.6
  /** Spring bounce factor (0 = no overshoot). */
  @property({ type: Number }) bounce = 0
  /** Delay before the transition starts, in seconds. */
  @property({ type: Number }) delay = 0
  /** Trigger source: `'view'` (when scrolled into view), `'hover'`, or `'scroll'` (progress-mapped). */
  @property({ type: String, reflect: true }) trigger: FontTrigger = 'view'
  /** When `true` and `trigger="view"`, only animate the first time it enters view. Set `once="false"` to turn it off. Ignored with `loop`. */
  @property({ type: Boolean, converter: flag }) once = true
  /** With `trigger="view"`, run from `from` to `to`, hold, back to `from`, wait, then repeat. */
  @property({ type: Boolean, converter: flag }) loop = false
  /** With `loop`, seconds the axes stay at `to` before they spring back to `from`. */
  @property({ type: Number }) hold = 1.6
  /** With `loop`, seconds the axes stay at `from` before they run to `to` again. */
  @property({ type: Number }) gap = 0.5
  /** Pause the loop while the pointer is over the text. */
  @property({ type: Boolean, converter: flag, attribute: 'pause-on-hover' }) pauseOnHover = false

  static styles = css`
    :host {
      display: inline;
    }
  `

  private baseProp: string
  private axesDef: AxisDef[] = []
  private scrollCleanup: (() => void) | null = null
  private hoverAnim: GroupAnimationWithThen | null = null
  private detachPauseOnHover: (() => void) | null = null

  private viewport = new LoopTrigger(this, {
    threshold: () => 0.2,
    once: () => this.once,
    loop: () => this.loop,
  })

  constructor() {
    super()
    this.baseProp = `--mc-_font-${_instanceCount++}`
  }

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  playback: PlaybackController = new PlaybackController(this, {
    start: () => {
      if (this.trigger === 'scroll') return this.scrollStart()
      if (this.loop) return { handle: this.cycle.start() }
      return this.autoStart()
    },
    applyFinalState: () => {
      this.cycle.stop()
      this.setAll((ax) => ax.to)
    },
    applyInitialState: () => {
      this.cycle.stop()
      this.setAll((ax) => ax.from)
    },
  })

  private cycle: LoopCycle = new LoopCycle({
    leg: (out) =>
      controlsRun(
        this.springAxes(
          (ax) => (out ? ax.to : ax.from),
          (ax) => (out ? ax.from : ax.to),
          0,
        ),
      ),
    hold: () => this.hold,
    gap: () => this.gap,
    delay: () => this.delay,
  })

  private springAxes(
    start: (ax: AxisDef) => number,
    target: (ax: AxisDef) => number,
    delay = this.delay,
  ) {
    return new GroupAnimationWithThen(
      this.axesDef.map((ax) => {
        const obj = { value: start(ax) }
        return animate(
          obj,
          { value: target(ax) },
          {
            duration: this.duration,
            type: 'spring',
            bounce: this.bounce,
            delay,
            onUpdate: () => this.style.setProperty(ax.prop, String(obj.value)),
          },
        )
      }),
    )
  }

  private autoStart() {
    return controlsRun(
      this.springAxes(
        (ax) => ax.from,
        (ax) => ax.to,
      ),
    )
  }

  private scrollStart() {
    this.scrollCleanup?.()
    this.scrollCleanup = scroll(
      (progress: number) => {
        for (const ax of this.axesDef) {
          const value = ax.from + progress * (ax.to - ax.from)
          this.style.setProperty(ax.prop, String(value))
        }
      },
      { target: this, offset: ['start end', 'end start'] },
    )
    return {
      handle: {
        pause: () => this.unbindScroll(),
        resume: () => this.scrollStart(),
        finish: () => {
          this.unbindScroll()
          this.setAll((ax) => ax.to)
        },
        cancel: () => this.unbindScroll(),
      },
    }
  }

  private unbindScroll() {
    this.scrollCleanup?.()
    this.scrollCleanup = null
  }

  private parseAxes(): AxisDef[] {
    if (this.axes.trim()) {
      return this.axes
        .trim()
        .split(/\s+/)
        .map((seg, i) => {
          const [axis, from, to] = seg.split(':')
          return { axis, from: Number(from), to: Number(to), prop: `${this.baseProp}-${i}` }
        })
    }
    return [{ axis: this.axis, from: this.from, to: this.to, prop: this.baseProp }]
  }

  firstUpdated() {
    this.axesDef = this.parseAxes()

    for (const ax of this.axesDef) {
      try {
        CSS.registerProperty({
          name: ax.prop,
          syntax: '<number>',
          inherits: false,
          initialValue: String(ax.from),
        })
      } catch {
        // Already registered
      }
    }

    for (const ax of this.axesDef) {
      this.style.setProperty(ax.prop, String(ax.from))
    }
    this.style.fontVariationSettings = this.axesDef
      .map((ax) => `'${ax.axis}' var(${ax.prop})`)
      .join(', ')

    if (this.trigger === 'hover') {
      this.addEventListener('mouseenter', this.onHoverIn)
      this.addEventListener('mouseleave', this.onHoverOut)
      this.addEventListener('focusin', this.onHoverIn)
      this.addEventListener('focusout', this.onHoverOut)
      return
    }

    if (this.reduced) {
      this.setAll((ax) => ax.to)
      return
    }

    if (this.trigger === 'scroll') {
      void this.play()
      return
    }

    // trigger === 'view'
    this.setupIntersect()
    this.detachPauseOnHover = pauseOnHover(
      this,
      () => this.loop && this.pauseOnHover,
      () => this.pause(),
      () => this.play(),
    )
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.viewport.disarm()
    this.unbindScroll()
    this.detachPauseOnHover?.()
    this.detachPauseOnHover = null
    this.removeEventListener('mouseenter', this.onHoverIn)
    this.removeEventListener('mouseleave', this.onHoverOut)
    this.removeEventListener('focusin', this.onHoverIn)
    this.removeEventListener('focusout', this.onHoverOut)
  }

  private setupIntersect() {
    this.viewport.arm()
  }

  private hoverTo(target: (ax: AxisDef) => number) {
    this.hoverAnim?.stop()
    if (this.reduced) {
      this.setAll(target)
      return
    }
    const current = (ax: AxisDef) => Number(this.style.getPropertyValue(ax.prop) || ax.from)
    this.hoverAnim = this.springAxes(current, target)
  }

  private onHoverIn = () => this.hoverTo((ax) => ax.to)

  private onHoverOut = () => this.hoverTo((ax) => ax.from)

  private setAll(getValue: (ax: AxisDef) => number) {
    for (const ax of this.axesDef) {
      this.style.setProperty(ax.prop, String(getValue(ax)))
    }
  }

  /** Resets axes to their `from` values and re-arms the viewport observer. Only valid when `trigger="view"`. */
  replay() {
    if (this.trigger !== 'view') return
    this.viewport.reset()
    this.cancel()
    this.setupIntersect()
  }

  render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-font': MotionFont
  }
}
