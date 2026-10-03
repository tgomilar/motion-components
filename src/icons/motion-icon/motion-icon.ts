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

const ELEMENTS = new Set(
  'svg g path line polyline polygon circle rect ellipse defs use symbol clippath mask lineargradient radialgradient stop title desc'.split(
    ' ',
  ),
)

function unsafe(name: string, value: string) {
  if (/^on/i.test(name) || /javascript:/i.test(value)) return true
  if (/(^|:)href$/i.test(name)) return !value.trim().startsWith('#')
  return /url\(\s*['"]?\s*[^'"\s#]/i.test(value)
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
 * Animates any SVG icon: draws its strokes in, or pops, bounces, rotates,
 * wiggles or pulses it on a spring. Works with stroke sets such as Lucide,
 * Tabler, Heroicons and Iconoir; filled icons (Phosphor, Bootstrap) fall back
 * from `draw` to `pop`. Pass the icon as a URL in `src`, as an SVG string in
 * `icon`, or as a child `<svg>`. The icon inherits `currentColor`. Inside a
 * button or link, `hover` and `click` follow that button or link.
 *
 * @element motion-icon
 *
 * @slot - An inline `<svg>` icon. Shown while `src` loads and ignored once `icon` or `src` renders.
 *
 * @fires motion-start - When an animation run starts.
 * @fires motion-finish - When an animation run finishes.
 * @fires error - When `src` cannot be loaded.
 *
 * @cssprop --icon-size - Width and height of the icon. Default `1.5em`.
 * @cssprop --icon-color - Icon color. Default `currentColor`.
 * @cssprop --icon-fill - Fills the inside of an outline icon. Default `none`.
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
    this.target = this.closest<HTMLElement>('button, a, [role="button"]') ?? this
    this.target.addEventListener('pointerenter', this.onHover)
    this.target.addEventListener('click', this.onClick)
    this.addEventListener('motion-finish', this.onFinish)
    if (this.hasUpdated) this.setup()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.target.removeEventListener('pointerenter', this.onHover)
    this.target.removeEventListener('click', this.onClick)
    this.removeEventListener('motion-finish', this.onFinish)
    this.disconnectIntersect?.()
    this.stopLoop()
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
    this.stopLoop()
    const container = this.renderRoot.querySelector<HTMLElement>('.icon')
    if (markup && container) {
      const svg = parseSvg(markup)
      container.replaceChildren(...(svg ? [svg] : []))
      this.svg = svg
    } else {
      container?.replaceChildren()
      this.svg = this.querySelector('svg')
    }
    if (this.svg?.getAttribute('fill') === 'none') this.svg.style.fill = 'var(--icon-fill, none)'
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
        return new GroupAnimationWithThen([
          ...this.strokes.map((el, i) =>
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
          animate(
            svg,
            { fillOpacity: [0, 1] },
            { duration: this.duration * 0.6, delay: this.delay + this.duration * 0.5 },
          ),
        ])
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
