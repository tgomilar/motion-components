import { LitElement, html, css, svg } from 'lit'
import { property } from 'lit/decorators.js'
import { animate } from 'motion'
import type { MotionThemeIconProps, ThemeIconMode } from './motion-theme-icon.types.js'
import { customElement } from '../../utils/define.js'

export type { MotionThemeIconProps, ThemeIconMode } from './motion-theme-icon.types.js'

type Pose = {
  core: { scale: number }
  cut: { x: number; y: number }
  half: { x: number }
  ring: { opacity: number }
  rays: { scale: number; rotate: number; opacity: number }
  body: { rotate: number }
}

const POSES: Record<ThemeIconMode, Pose> = {
  light: {
    core: { scale: 0.56 },
    cut: { x: 14, y: -14 },
    half: { x: 12 },
    ring: { opacity: 0 },
    rays: { scale: 1, rotate: 0, opacity: 1 },
    body: { rotate: 0 },
  },
  dark: {
    core: { scale: 1 },
    cut: { x: 0, y: 0 },
    half: { x: 12 },
    ring: { opacity: 0 },
    rays: { scale: 0, rotate: -90, opacity: 0 },
    body: { rotate: -30 },
  },
  system: {
    core: { scale: 0.89 },
    cut: { x: 14, y: -14 },
    half: { x: 0 },
    ring: { opacity: 1 },
    rays: { scale: 0, rotate: 90, opacity: 0 },
    body: { rotate: 0 },
  },
}

const RAYS = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4
  const p = (r: number) => [12 + Math.cos(a) * r, 12 + Math.sin(a) * r].map((n) => n.toFixed(2))
  const [x1, y1] = p(7.5)
  const [x2, y2] = p(10)
  return svg`<line x1=${x1} y1=${y1} x2=${x2} y2=${y2} />`
})

let uid = 0

/**
 * Sun, moon and system glyph that morphs between modes with spring physics.
 * Used by `<motion-theme-toggle>`, and usable on its own wherever a theme
 * indicator is needed. Inherits `currentColor`.
 *
 * **Use it for:** showing the current theme inside your own theme control,
 * or next to a theme setting.
 *
 * **Avoid it for:** switching the theme; it only draws the glyph. Use
 * `motion-theme-toggle` for a working control. For other animated icons, use
 * `motion-icon` or `motion-state-icon`.
 *
 * **Accessibility:** the SVG has `aria-hidden="true"` and the element has no
 * role or label, so screen readers skip it. When it is the only content of a
 * button, give the button an `aria-label`.
 *
 * **Reduced motion:** the glyph changes to the new mode at once, with no
 * morph.
 *
 * **Common mistakes:** expecting `mode` to change the page theme; it only
 * changes the drawing, so update `mode` from your own code when the theme
 * changes. A misspelled `mode` value shows the sun, so use `light`, `dark` or
 * `system`.
 *
 * @element motion-theme-icon
 *
 * @cssprop --theme-icon-size - Width and height of the icon. Default `1.5em`.
 *
 * @example
 * ```html
 * <motion-theme-icon mode="dark"></motion-theme-icon>
 * ```
 */
@customElement('motion-theme-icon')
export class MotionThemeIcon extends LitElement implements MotionThemeIconProps {
  /** Glyph to show: `'light'` (sun), `'dark'` (moon) or `'system'` (half disc). */
  @property({ type: String, reflect: true }) mode: ThemeIconMode = 'light'
  /** Spring duration of the morph, in seconds. */
  @property({ type: Number }) duration = 0.5
  /** Spring bounciness (0 = critically damped, higher = more elastic). */
  @property({ type: Number }) bounce = 0.25

  static styles = css`
    :host {
      display: inline-block;
      width: var(--theme-icon-size, 1.5em);
      height: var(--theme-icon-size, 1.5em);
      line-height: 0;
    }
    svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .core,
    .cut,
    .half,
    .rays,
    .body {
      transform-box: fill-box;
      transform-origin: center;
    }
    .rays {
      transform-box: view-box;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
    }
    .ring {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
    }
  `

  private maskId = `motion-theme-icon-${++uid}`

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  updated(changed: Map<string, unknown>) {
    if (!changed.has('mode')) return
    const instant = changed.get('mode') === undefined || this.reduced
    this.pose(POSES[this.mode] ?? POSES.light, instant)
  }

  private pose(pose: Pose, instant: boolean) {
    const transition = instant
      ? { duration: 0 }
      : { type: 'spring' as const, duration: this.duration, bounce: this.bounce }
    for (const [part, values] of Object.entries(pose)) {
      const el = this.renderRoot.querySelector(`.${part}`)
      if (el) animate(el, values, transition)
    }
  }

  render() {
    return html`
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
        <defs>
          <mask id=${this.maskId}>
            <rect x="-6" y="-6" width="36" height="36" fill="white" />
            <circle class="cut" cx="16" cy="8" r="8" fill="black" />
            <rect class="half" x="12" y="-6" width="18" height="36" fill="black" />
          </mask>
        </defs>
        <g class="body">
          <circle class="core" cx="12" cy="12" r="9" mask="url(#${this.maskId})" />
          <circle class="ring" cx="12" cy="12" r="8" />
        </g>
        <g class="rays">${RAYS}</g>
      </svg>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-theme-icon': MotionThemeIcon
  }
}
