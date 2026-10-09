import { LitElement, html, css } from 'lit'
import { property } from 'lit/decorators.js'
import { animate, stagger } from 'motion'
import type { AnimationPlaybackControlsWithThen, AnimationSequence } from 'motion'
import { Controllable, PlaybackController, controlsHandle } from '../../utils/playback.js'
import type { PlaybackRun } from '../../utils/playback.js'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'
import { useIntersect } from '../../text/utils/use-intersect.js'
import { LoopCycle } from '../../text/utils/loop.js'
import type {
  IconAnimation,
  IconMotion,
  IconTrigger,
  MotionIconProps,
} from './motion-icon.types.js'

export type {
  IconAnimation,
  IconMotion,
  IconTrigger,
  MotionIconProps,
} from './motion-icon.types.js'

const SHAPES = 'path, line, polyline, polygon, circle, rect, ellipse'

const MOTIONS = new Set<string>([
  'pop',
  'bounce',
  'rotate',
  'wiggle',
  'pulse',
  'slide-up',
  'slide-down',
  'slide-left',
  'slide-right',
])

const SLIDE: Record<string, [x: number, y: number]> = {
  'slide-up': [0, -1],
  'slide-down': [0, 1],
  'slide-left': [-1, 0],
  'slide-right': [1, 0],
}

type Segment = AnimationSequence[number]

function pose(el: Element) {
  const t = getComputedStyle(el).transform
  if (!t || t === 'none') return { x: 0, y: 0, scale: 1, rotate: 0 }
  const { a, b, e, f } = new DOMMatrixReadOnly(t)
  return { x: e, y: f, scale: Math.hypot(a, b), rotate: (Math.atan2(b, a) * 180) / Math.PI }
}

const ELEMENTS = new Set(
  'svg g path line polyline polygon circle rect ellipse defs use symbol clippath mask lineargradient radialgradient stop title desc'.split(
    ' ',
  ),
)

function cssUnescape(value: string) {
  return value.replace(/\\([0-9a-f]{1,6})\s?|\\([\s\S])/gi, (_, hex: string, ch: string) => {
    if (!hex) return ch
    const code = parseInt(hex, 16)
    return code && code <= 0x10ffff ? String.fromCodePoint(code) : '\ufffd'
  })
}

function unsafe(name: string, value: string) {
  if (/^on/i.test(name) || name.toLowerCase() === 'style') return true
  if (/(^|:)href$/i.test(name)) return !value.trim().startsWith('#')
  const css = cssUnescape(value)
  return /javascript:|image(-set)?\(/i.test(css) || /url\(\s*['"]?\s*[^'"\s#]/i.test(css)
}

/** Parses SVG markup, keeping only drawing elements and local references. */
function parseSvg(markup: string): SVGSVGElement | null {
  const source = /<svg[^>]*\sxmlns=/.test(markup)
    ? markup.trim()
    : markup.trim().replace(/<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml')
  const svg = doc.documentElement
  if (svg.localName !== 'svg' || doc.querySelector('parsererror')) return null
  for (const el of [...svg.querySelectorAll('*')]) {
    if (!ELEMENTS.has(el.localName.toLowerCase())) el.remove()
  }
  for (const el of [svg, ...svg.querySelectorAll('*')]) {
    for (const attr of [...el.attributes]) {
      if (unsafe(attr.name, attr.value)) el.removeAttribute(attr.name)
    }
  }
  if (!svg.hasAttribute('fill')) svg.setAttribute('fill', 'currentColor')
  svg.removeAttribute('width')
  svg.removeAttribute('height')
  return document.importNode(svg, true) as unknown as SVGSVGElement
}

/**
 * The stroke a shape paints, read from its own and its ancestors' attributes and inline styles.
 * Unlike the computed style, this works while the icon is slotted into a component that has
 * not rendered yet, where Chromium reports an empty stroke.
 */
function declaredStroke(el: Element, svg: SVGSVGElement): string | null {
  for (let node: Element | null = el; node; node = node === svg ? null : node.parentElement) {
    const value = (node as SVGElement).style.stroke || node.getAttribute('stroke')
    if (value) return value
  }
  return null
}

const requests = new Map<string, Promise<string>>()

function fetchIcon(url: string) {
  let request = requests.get(url)
  if (!request) {
    request = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`${res.status} ${url}`)
      return res.text()
    })
    request.catch(() => requests.delete(url))
    requests.set(url, request)
  }
  return request
}

/**
 * Animates any SVG icon on a spring: it draws the strokes in, or makes the
 * icon pop, bounce, rotate, wiggle, pulse or slide up, down, left or right.
 * It can also do both at once, as in `animation="draw wiggle"`. Every run
 * starts from where the icon is, so hovering again mid-animation never
 * makes it jump. With `trigger="hover"`, a slide holds while the pointer is
 * over it and springs back on leave. Pass the icon as a URL in `src`, as an SVG
 * string in `icon`, or as a child `<svg>`. Stroke sets such as Lucide,
 * Tabler, Heroicons and Iconoir can draw; filled icons such as Phosphor and
 * Bootstrap pop instead. The icon takes `currentColor`. Inside a button, a
 * link or a `<summary>`, `hover` and `click` follow that element.
 *
 * **Use it for:** icons that draw in or move when people hover or click a
 * button or link, when they scroll into view, or once when the page loads.
 * It works with any SVG icon.
 *
 * **Avoid it for:** icons that switch between two states, such as menu and
 * close or play and pause; use `motion-icon-state`. Avoid `trigger="loop"`
 * next to text people need to read, because the loop never stops on its own.
 *
 * **Accessibility:** without `label` the icon is decorative and gets
 * `aria-hidden="true"`. With `label` it gets `role="img"` and that name as
 * `aria-label`. The icon is never focusable, and `trigger="hover"` reacts to
 * the pointer only, not to keyboard focus. Inside a button or link with
 * visible text, leave `label` empty. An icon-only button needs a name: set
 * `aria-label` on the button, or `label` on the icon.
 *
 * **Reduced motion:** the icon shows its final state at once, with no
 * animation. With `draw` and `trigger="view"`, the icon stays hidden until it
 * scrolls into view and then appears at once.
 *
 * **Common mistakes:** using `animation="draw"` with a filled icon, such as
 * Phosphor or Bootstrap: there are no strokes to draw, so it pops instead.
 * Setting `label` on an icon inside a button that already has text, so
 * screen readers read the name twice.
 * Listing two motions, such as `animation="pop wiggle"`: only `draw` combines
 * with a motion, so only the first motion runs.
 *
 * @element motion-icon
 *
 * @slot - An inline `<svg>` icon. Shown while `src` loads and ignored once `icon` or `src` renders.
 *
 * @fires motion-start - When an animation run starts.
 * @fires motion-finish - When an animation run finishes.
 * @fires error - When `src` cannot be loaded.
 * @fires motion-cancel - When `cancel()` stops a run and resets it.
 *
 * @cssprop --mc-icon-size - Width and height of the icon. Default `1.5em`.
 * @cssprop --mc-icon-color - Icon color. Default `currentColor`.
 * @cssprop --mc-icon-fill - Fills the inside of an outline icon. Default `none`.
 *
 * @csspart icon - The wrapper around the rendered `icon` SVG.
 *
 * @example
 * ```html
 * <motion-icon src="https://cdn.jsdelivr.net/npm/lucide-static@1/icons/heart.svg"></motion-icon>
 * ```
 */
@customElement('motion-icon')
export class MotionIcon extends Controllable(LitElement) implements MotionIconProps {
  /** URL of an SVG file, for example from a CDN or your own `/icons` folder. Responses are cached per URL. */
  @property({ type: String }) src = ''
  /** SVG markup to render, for example `import { Heart } from 'lucide-static'`. Takes precedence over `src`. */
  @property({ type: String }) icon = ''
  /** `'draw'`, `'pop'`, `'bounce'`, `'rotate'`, `'wiggle'`, `'pulse'`, `'slide-up'`, `'slide-down'`, `'slide-left'` or `'slide-right'`, or `draw` plus one of the others, such as `'draw slide-right'`, to run both. `draw` needs a stroke icon and falls back to `pop`. */
  @property({ type: String, reflect: true }) animation: IconAnimation = 'draw'
  /** What starts the animation: `'hover'`, `'click'`, `'view'` (scrolled into view), `'mount'` or `'loop'`. */
  @property({ type: String, reflect: true }) trigger: IconTrigger = 'hover'
  /** Duration of one run, in seconds. */
  @property({ type: Number }) duration = 0.6
  /** Spring bounciness as the icon settles (0 = no overshoot). `wiggle` always uses at least `0.6`. */
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
      width: var(--mc-icon-size, 1.5em);
      height: var(--mc-icon-size, 1.5em);
      color: var(--mc-icon-color, inherit);
      line-height: 0;
      vertical-align: middle;
    }
    .icon,
    ::slotted(svg) {
      width: 100%;
      height: 100%;
    }
    .icon:not(:empty) + slot {
      display: none;
    }
    .icon svg,
    ::slotted(svg) {
      width: 100%;
      height: 100%;
      overflow: visible;
      transform-origin: 50% 50%;
    }
  `

  private markup = ''
  private target: HTMLElement = this
  private svg: SVGSVGElement | null = null
  private strokes: SVGElement[] = []
  private disconnectIntersect: (() => void) | null = null
  private hovering = false
  private keepPose = false

  private get parts(): { draw: boolean; motion: IconMotion | null } {
    const tokens = this.animation.trim().split(/\s+/)
    const motion = (tokens.find((t) => MOTIONS.has(t)) as IconMotion | undefined) ?? null
    const draw = tokens.includes('draw') && this.strokes.length > 0
    return { draw, motion: motion ?? (draw ? null : 'pop') }
  }

  private get startsHidden() {
    return (
      this.parts.draw &&
      (this.trigger === 'view' || this.trigger === 'mount' || this.trigger === 'loop')
    )
  }

  playback: PlaybackController = new PlaybackController(this, {
    start: () => (this.trigger === 'loop' ? { handle: this.cycle.start() } : this.runOnce()),
    applyFinalState: () => {
      this.cycle.stop()
      this.settle()
    },
    applyInitialState: () => {
      if (this.keepPose) return
      this.cycle.stop()
      if (this.startsHidden) this.hide()
      else this.settle()
    },
  })

  private cycle: LoopCycle = new LoopCycle({
    leg: (out: boolean) => (out ? null : this.runOnce()),
    gap: () => this.interval,
  })

  private runOnce(): PlaybackRun {
    if (!this.svg)
      return {
        handle: { pause() {}, resume() {}, finish() {}, cancel() {} },
        done: Promise.resolve(),
      }
    const controls = this.run()
    return {
      handle: {
        ...controlsHandle(controls),
        cancel: () => (this.keepPose ? controls.stop() : controls.cancel()),
      },
      done: controls,
    }
  }

  connectedCallback() {
    super.connectedCallback()
    this.target = this.closest<HTMLElement>('button, a, summary, [role="button"]') ?? this
    this.target.addEventListener('pointerenter', this.onHover)
    this.target.addEventListener('pointerleave', this.onLeave)
    this.target.addEventListener('click', this.onClick)
    if (this.hasUpdated) this.setup()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.target.removeEventListener('pointerenter', this.onHover)
    this.target.removeEventListener('pointerleave', this.onLeave)
    this.target.removeEventListener('click', this.onClick)
    this.disconnectIntersect?.()
    this.cycle.stop()
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('label')) this.applyLabel()
    if (changed.has('icon') || changed.has('src')) void this.load()
    else if (changed.has('animation') || changed.has('trigger')) this.setup()
  }

  private async load() {
    const { icon, src } = this
    if (icon || !src) return this.setup(icon)
    const markup = await fetchIcon(src).catch(() => {
      this.dispatchEvent(new Event('error'))
      return ''
    })
    if (this.icon === icon && this.src === src) this.setup(markup)
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
    if (!this.markup) this.setup()
  }

  private setup(markup = this.markup) {
    this.markup = markup
    this.disconnectIntersect?.()
    this.disconnectIntersect = null
    this.cycle.stop()
    const container = this.renderRoot.querySelector<HTMLElement>('.icon')
    if (markup && container) {
      const svg = parseSvg(markup)
      container.replaceChildren(...(svg ? [svg] : []))
      this.svg = svg
    } else {
      container?.replaceChildren()
      this.svg = this.querySelector('svg')
    }
    if (this.svg?.getAttribute('fill') === 'none') this.svg.style.fill = 'var(--mc-icon-fill, none)'
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
      const stroke = declaredStroke(el, svg) ?? getComputedStyle(el).stroke
      return Boolean(stroke) && stroke !== 'none'
    })
  }

  private get holdsSlide() {
    return this.trigger === 'hover' && this.parts.motion?.startsWith('slide-')
  }

  private run(): AnimationPlaybackControlsWithThen {
    const svg = this.svg!
    const { draw, motion } = this.parts
    const leaving = this.holdsSlide && !this.hovering
    const sequence: Segment[] = [
      ...(draw && !leaving ? this.draw(svg) : []),
      ...(motion ? this.move(svg, motion) : []),
    ]
    return animate(sequence, { delay: this.delay })
  }

  private get spring() {
    return { type: 'spring' as const, duration: this.duration, bounce: this.bounce }
  }

  private draw(svg: SVGSVGElement): Segment[] {
    const out = this.duration * 0.3
    const drawn = this.strokes.some((el) => Number(el.style.strokeDashoffset || 0) < 0.999)
    const lead = drawn ? out : 0
    const segments: Segment[] = []
    if (drawn) {
      for (const el of this.strokes) {
        const from = Number(el.style.strokeDashoffset || 0)
        segments.push([
          el,
          { strokeDashoffset: [from, 1] },
          { duration: out, ease: 'easeIn', at: 0 },
        ])
      }
      const fill = Number(getComputedStyle(svg).fillOpacity)
      segments.push([svg, { fillOpacity: [fill, 0] }, { duration: out, at: 0 }])
    }
    this.strokes.forEach((el, i) => {
      segments.push([
        el,
        { strokeDashoffset: [1, 0] },
        {
          type: 'spring',
          bounce: 0,
          duration: this.duration,
          at: lead + stagger(this.duration * 0.12)(i, this.strokes.length),
        },
      ])
    })
    segments.push([
      svg,
      { fillOpacity: [0, 1] },
      { duration: this.duration * 0.6, at: lead + this.duration * 0.5 },
    ])
    return segments
  }

  private move(svg: SVGSVGElement, motion: IconMotion): Segment[] {
    const from = pose(svg)
    const size = svg.getBoundingClientRect().height || 24
    const out = (key: string, start: number, peak: number): Segment => [
      svg,
      { [key]: [start, peak] },
      { type: 'spring', bounce: 0, duration: this.duration * 0.35, at: 0 },
    ]
    const back = (key: string, peak: number, bounce = this.bounce): Segment => [
      svg,
      { [key]: [peak, key === 'scale' ? 1 : 0] },
      { type: 'spring', duration: this.duration, bounce },
    ]
    const settle = (key: string, start: number, end: number): Segment[] => [
      [
        svg,
        { [key]: [start, end] },
        { type: 'spring', duration: this.duration, bounce: this.bounce, at: 0 },
      ],
    ]

    if (motion in SLIDE) {
      const [dx, dy] = SLIDE[motion]
      const key = dx ? 'x' : 'y'
      const start = dx ? from.x : from.y
      const peak = (dx || dy) * size * 0.25
      if (this.holdsSlide) return settle(key, start, this.hovering ? peak : 0)
      return [out(key, start, peak), back(key, peak)]
    }
    if (motion === 'pop') return [out('scale', from.scale, 0.7), back('scale', 0.7)]
    if (motion === 'bounce') return [out('y', from.y, -size * 0.3), back('y', -size * 0.3)]
    // The pose angle wraps into (-180, 180]; read it as 0 to 360 so an interrupted turn finishes forward
    if (motion === 'rotate') return settle('rotate', (from.rotate + 360) % 360, 360)
    if (motion === 'wiggle')
      return [out('rotate', from.rotate, -14), back('rotate', -14, Math.max(this.bounce, 0.6))]
    return [out('scale', from.scale, 1.18), back('scale', 1.18)]
  }

  /** Cancels an in-flight run without resetting the pose, so the next run starts where the icon is. */
  private restart() {
    if (this.playState === 'running' || this.playState === 'paused') {
      this.keepPose = true
      this.cancel()
      this.keepPose = false
    }
    void this.play()
  }

  private hide() {
    for (const el of this.strokes) el.style.strokeDashoffset = '1'
    if (this.svg) this.svg.style.fillOpacity = '0'
  }

  private settle() {
    for (const el of this.strokes) el.style.strokeDashoffset = '0'
    if (this.svg) {
      this.svg.style.transform = ''
      this.svg.style.fillOpacity = ''
    }
  }

  private onHover = () => {
    this.hovering = true
    if (this.trigger === 'hover') this.restart()
  }

  private onLeave = () => {
    this.hovering = false
    if (this.holdsSlide) this.restart()
  }

  private onClick = () => {
    if (this.trigger === 'click') this.restart()
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
