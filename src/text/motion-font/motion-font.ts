import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { animate, scroll } from 'motion'
import { useIntersect } from '../utils/use-intersect.js'
import { Controllable, PlaybackController, controlsRun } from '../../utils/playback.js'
import type { MotionFontProps, FontTrigger } from './motion-font.types.js'
import type { AnimationPlaybackControls } from 'motion'

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
 * @element motion-font
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
export class MotionFont extends Controllable(LitElement) implements MotionFontProps {
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
  /** Trigger source: `'auto'` (viewport), `'hover'`, or `'scroll'` (progress-mapped). */
  @property({ type: String, reflect: true }) trigger: FontTrigger = 'auto'
  /** When `true` and `trigger="auto"`, only animate the first time it enters view. */
  @property({ type: Boolean }) once = true

  static styles = css`
    :host {
      display: inline;
    }
  `

  private baseProp: string
  private axesDef: AxisDef[] = []
  private disconnectIntersect: (() => void) | null = null
  private scrollCleanup: (() => void) | null = null
  private triggered = false
  private hoverInAnim: AnimationPlaybackControls | null = null
  private hoverOutAnim: AnimationPlaybackControls | null = null

  constructor() {
    super()
    this.baseProp = `--mf-${_instanceCount++}`
  }

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  playback: PlaybackController = new PlaybackController(this, {
    start: () => {
      if (this.trigger === 'scroll') {
        return this.scrollStart()
      }
      return this.autoStart()
    },
    applyFinalState: () => {
      this.setAll((ax) => ax.to)
    },
    applyInitialState: () => {
      this.setAll((ax) => ax.from)
    },
  })

  private autoStart() {
    const targets = this.axesDef.map((ax) => ax.to)
    const controls: AnimationPlaybackControls[] = []
    for (let i = 0; i < this.axesDef.length; i++) {
      const ax = this.axesDef[i]
      const obj = { value: ax.from }
      const c = animate(
        obj,
        { value: targets[i] },
        {
          duration: this.duration,
          type: 'spring',
          bounce: this.bounce,
          delay: this.delay,
          onUpdate: () => this.style.setProperty(ax.prop, String(obj.value)),
        },
      )
      controls.push(c)
    }
    return controlsRun(controls[0])
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

    // trigger === 'auto'
    this.setupIntersect()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.disconnectIntersect?.()
    this.unbindScroll()
    this.removeEventListener('mouseenter', this.onHoverIn)
    this.removeEventListener('mouseleave', this.onHoverOut)
    this.removeEventListener('focusin', this.onHoverIn)
    this.removeEventListener('focusout', this.onHoverOut)
  }

  private setupIntersect() {
    this.disconnectIntersect?.()
    this.disconnectIntersect = useIntersect(this, 0.2, () => {
      if (!this.triggered && this.playState === 'idle') {
        void this.play()
        if (this.once) {
          this.triggered = true
          this.disconnectIntersect?.()
        }
      }
    })
  }

  private onHoverIn = () => {
    this.hoverOutAnim?.stop()
    const targets = this.axesDef.map((ax) => ax.to)
    const controls: AnimationPlaybackControls[] = []
    for (let i = 0; i < this.axesDef.length; i++) {
      const ax = this.axesDef[i]
      const current = Number(this.style.getPropertyValue(ax.prop) || ax.from)
      const obj = { value: current }
      const c = animate(
        obj,
        { value: targets[i] },
        {
          duration: this.duration,
          type: 'spring',
          bounce: this.bounce,
          delay: this.delay,
          onUpdate: () => this.style.setProperty(ax.prop, String(obj.value)),
        },
      )
      controls.push(c)
    }
    this.hoverInAnim = controls[0]
  }

  private onHoverOut = () => {
    this.hoverInAnim?.stop()
    const targets = this.axesDef.map((ax) => ax.from)
    const controls: AnimationPlaybackControls[] = []
    for (let i = 0; i < this.axesDef.length; i++) {
      const ax = this.axesDef[i]
      const current = Number(this.style.getPropertyValue(ax.prop) || ax.to)
      const obj = { value: current }
      const c = animate(
        obj,
        { value: targets[i] },
        {
          duration: this.duration,
          type: 'spring',
          bounce: this.bounce,
          delay: this.delay,
          onUpdate: () => this.style.setProperty(ax.prop, String(obj.value)),
        },
      )
      controls.push(c)
    }
    this.hoverOutAnim = controls[0]
  }

  private setAll(getValue: (ax: AxisDef) => number) {
    for (const ax of this.axesDef) {
      this.style.setProperty(ax.prop, String(getValue(ax)))
    }
  }

  /** Resets axes to their `from` values and re-arms the viewport observer. Only valid when `trigger="auto"`. */
  replay() {
    if (this.trigger !== 'auto') return
    this.triggered = false
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
