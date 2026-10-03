import { LitElement, html, css } from 'lit'
import { property } from 'lit/decorators.js'
import { animate, stagger, GroupAnimationWithThen } from 'motion'
import type { AnimationPlaybackControlsWithThen } from 'motion'
import { Controllable, PlaybackController, controlsRun } from '../../utils/playback.js'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'
import { useIntersect } from '../../text/utils/use-intersect.js'
import type { IconAnimation, IconTrigger, MotionIconProps } from './motion-icon.types.js'

export type { IconAnimation, IconTrigger, MotionIconProps } from './motion-icon.types.js'

const SHAPES = 'path, line, polyline, polygon, circle, rect, ellipse'

/** Parses SVG markup and drops anything that could run script. */
function parseSvg(markup: string): SVGSVGElement | null {
  const source = /<svg[^>]*\sxmlns=/.test(markup)
    ? markup.trim()
    : markup.trim().replace(/<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml')
  const svg = doc.documentElement
  if (svg.localName !== 'svg' || doc.querySelector('parsererror')) return null
  svg.querySelectorAll('script, foreignObject').forEach((el) => el.remove())
  for (const el of [svg, ...svg.querySelectorAll('*')]) {
    for (const attr of [...el.attributes]) {
      if (/^on/i.test(attr.name) || /^\s*javascript:/i.test(attr.value))
        el.removeAttribute(attr.name)
    }
  }
  return document.importNode(svg, true) as unknown as SVGSVGElement
}

/**
 * Animates any SVG icon: draws its strokes in, or pops, bounces, rotates,
 * wiggles or pulses it on a spring. Works with stroke sets such as Lucide,
 * Tabler, Heroicons and Iconoir; filled icons (Phosphor, Bootstrap) fall back
 * from `draw` to `pop`. Pass the icon as child `<svg>` or as an SVG string in
 * `icon`. The icon inherits `currentColor`.
 *
 * @element motion-icon
 *
 * @slot - An inline `<svg>` icon. Ignored when `icon` is set.
 *
 * @fires motion-start - When an animation run starts.
 * @fires motion-finish - When an animation run finishes.
 *
 * @cssprop --icon-size - Width and height of the icon. Default `1.5em`.
 * @cssprop --icon-color - Icon color. Default `currentColor`.
 *
 * @csspart icon - The wrapper around the rendered `icon` SVG.
 *
 * @example
 * ```html
 * <motion-icon animation="draw" trigger="hover">
 *   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">…</svg>
 * </motion-icon>
 * ```
 */
@customElement('motion-icon')
export class MotionIcon extends Controllable(LitElement) implements MotionIconProps {
  /** SVG markup to render, for example `import { Heart } from 'lucide-static'`. Script and event handlers are removed. */
  @property({ type: String }) icon = ''
  /** `'draw'`, `'pop'`, `'bounce'`, `'rotate'`, `'wiggle'` or `'pulse'`. `draw` needs a stroke icon and falls back to `pop`. */
  @property({ type: String, reflect: true }) animation: IconAnimation = 'draw'
  /** What starts the animation: `'hover'`, `'click'`, `'view'` (scrolled into view), `'mount'` or `'loop'`. */
  @property({ type: String, reflect: true }) trigger: IconTrigger = 'hover'
  /** Duration of one run, in seconds. */
  @property({ type: Number }) duration = 0.6
  /** Spring bounciness for `pop`, `bounce` and `rotate` (0 = no overshoot). */
  @property({ type: Number }) bounce = 0.4
  /** Seconds to wait before the animation starts. */
  @property({ type: Number }) delay = 0
  /** Seconds to pause between runs when `trigger="loop"`. */
  @property({ type: Number }) interval = 1.2
  /** With `trigger="view"`, only animate the first time. Set `once="false"` to replay on every entry. */
  @property({ type: Boolean, converter: flag }) once = true
  /** Accessible name. Without it the icon is decorative and hidden from screen readers. */
  @property({ type: String }) label = ''

  static styles = css`
    :host {
      display: inline-block;
      width: var(--icon-size, 1.5em);
      height: var(--icon-size, 1.5em);
      color: var(--icon-color, inherit);
      line-height: 0;
      vertical-align: middle;
    }
    .icon,
    ::slotted(svg) {
      width: 100%;
      height: 100%;
    }
    .icon svg,
    ::slotted(svg) {
      width: 100%;
      height: 100%;
      overflow: visible;
      transform-origin: 50% 50%;
    }
  `

  private svg: SVGSVGElement | null = null
  private strokes: SVGElement[] = []
  private disconnectIntersect: (() => void) | null = null
  private loopTimer: ReturnType<typeof setTimeout> | null = null

  private get mode(): IconAnimation {
    return this.animation === 'draw' && !this.strokes.length ? 'pop' : this.animation
  }

  private get startsHidden() {
    return (
      this.mode === 'draw' &&
      (this.trigger === 'view' || this.trigger === 'mount' || this.trigger === 'loop')
    )
  }

  playback: PlaybackController = new PlaybackController(this, {
    start: () => {
      if (!this.svg)
        return {
          handle: { pause() {}, resume() {}, finish() {}, cancel() {} },
          done: Promise.resolve(),
        }
      return controlsRun(this.run())
    },
    applyFinalState: () => this.settle(),
    applyInitialState: () => (this.startsHidden ? this.hide() : this.settle()),
  })

  connectedCallback() {
    super.connectedCallback()
    this.addEventListener('pointerenter', this.onHover)
    this.addEventListener('click', this.onClick)
    this.addEventListener('motion-finish', this.onFinish)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener('pointerenter', this.onHover)
    this.removeEventListener('click', this.onClick)
    this.removeEventListener('motion-finish', this.onFinish)
    this.disconnectIntersect?.()
    this.stopLoop()
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('label')) this.applyLabel()
    if (changed.has('icon') || changed.has('animation') || changed.has('trigger')) this.setup()
  }

  private applyLabel() {
    if (this.label) {
      this.setAttribute('role', 'img')
      this.setAttribute('aria-label', this.label)
      this.removeAttribute('aria-hidden')
    } else {
      this.removeAttribute('role')
      this.removeAttribute('aria-label')
      this.setAttribute('aria-hidden', 'true')
    }
  }

  private onSlotChange = () => {
    if (!this.icon) this.setup()
  }

  private setup() {
    this.disconnectIntersect?.()
    this.disconnectIntersect = null
    this.stopLoop()
    const container = this.renderRoot.querySelector<HTMLElement>('.icon')
    if (this.icon && container) {
      const svg = parseSvg(this.icon)
      container.replaceChildren(...(svg ? [svg] : []))
      this.svg = svg
    } else {
      container?.replaceChildren()
      this.svg = this.querySelector('svg')
    }
    this.strokes = this.svg ? this.findStrokes(this.svg) : []
    for (const el of this.strokes) {
      el.setAttribute('pathLength', '1')
      el.style.strokeDasharray = '1'
    }
    this.cancel()
    if (this.startsHidden) this.hide()
    else this.settle()

    if (!this.svg) return
    if (this.trigger === 'mount' || this.trigger === 'loop') void this.play()
    if (this.trigger === 'view') {
      this.disconnectIntersect = useIntersect(
        this,
        0.4,
        () => {
          if (this.playState !== 'idle') return
          void this.play()
          if (this.once) this.disconnectIntersect?.()
        },
        () => {
          if (!this.once && this.playState !== 'idle') this.cancel()
        },
      )
    }
  }

  private findStrokes(svg: SVGSVGElement) {
    return [...svg.querySelectorAll<SVGElement>(SHAPES)].filter((el) => {
      if (el.getAttribute('stroke') === 'none') return false
      const stroke = getComputedStyle(el).stroke
      return Boolean(stroke) && stroke !== 'none'
    })
  }

  private run(): AnimationPlaybackControlsWithThen {
    const svg = this.svg!
    const spring = {
      type: 'spring' as const,
      duration: this.duration,
      bounce: this.bounce,
      delay: this.delay,
    }
    const keys = { duration: this.duration, ease: 'easeInOut' as const, delay: this.delay }
    switch (this.mode) {
      case 'draw':
        return new GroupAnimationWithThen(
          this.strokes.map((el, i) =>
            animate(
              el,
              { strokeDashoffset: [1, 0] },
              {
                type: 'spring',
                bounce: 0,
                duration: this.duration,
                delay: this.delay + stagger(0.08)(i, this.strokes.length),
              },
            ),
          ),
        )
      case 'pop':
        return animate(svg, { scale: [0.6, 1] }, spring)
      case 'bounce':
        return animate(svg, { y: [-svg.getBoundingClientRect().height * 0.3, 0] }, spring)
      case 'rotate':
        return animate(svg, { rotate: [-180, 0] }, spring)
      case 'wiggle':
        return animate(svg, { rotate: [0, -14, 12, -8, 5, 0] }, keys)
      case 'pulse':
        return animate(svg, { scale: [1, 1.18, 1] }, keys)
    }
  }

  private hide() {
    for (const el of this.strokes) el.style.strokeDashoffset = '1'
  }

  private settle() {
    for (const el of this.strokes) el.style.strokeDashoffset = '0'
    if (this.svg) this.svg.style.transform = ''
  }

  private onHover = () => {
    if (this.trigger === 'hover') this.replay()
  }

  private onClick = () => {
    if (this.trigger === 'click') this.replay()
  }

  private onFinish = () => {
    if (this.trigger !== 'loop' || !this.isConnected) return
    this.stopLoop()
    this.loopTimer = setTimeout(() => this.replay(), this.interval * 1000)
  }

  private stopLoop() {
    if (this.loopTimer) clearTimeout(this.loopTimer)
    this.loopTimer = null
  }

  /** Restarts the animation from its starting state. */
  replay() {
    this.cancel()
    void this.play()
  }

  render() {
    return html`<span class="icon" part="icon"></span
      ><slot @slotchange=${this.onSlotChange}></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-icon': MotionIcon
  }
}
