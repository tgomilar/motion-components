import { LitElement, html, css, nothing } from 'lit'
import { property } from 'lit/decorators.js'
import { animate } from 'motion'
import type { AnimationPlaybackControls } from 'motion'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'
import { ICONS } from './icons.js'
import type {
  MotionStateIconProps,
  StateIconChangeDetail,
  StateIconName,
} from './motion-state-icon.types.js'

export type {
  MotionStateIconProps,
  StateIconChangeDetail,
  StateIconName,
} from './motion-state-icon.types.js'

/**
 * An icon that morphs between two states with spring physics: menu and close,
 * play and pause, copy and check, plus and minus, chevron down and up, an empty
 * and a filled heart, loading and done, and eye and eye-off. Drawn on a 24 px
 * grid with 2 px round strokes, so it sits next to Lucide, Tabler and Heroicons.
 *
 * @element motion-state-icon
 *
 * @fires motion-change - When `toggle` is set and the user switches the state. `detail: { active }`.
 *
 * @cssprop --icon-size - Width and height of the icon. Default `1.5em`.
 * @cssprop --icon-color - Line color. Default `currentColor`.
 * @cssprop --icon-accent - Accent color for the filled heart and the copy and loading checks.
 *
 * @example
 * ```html
 * <motion-state-icon name="menu" toggle label="Menu"></motion-state-icon>
 * <motion-state-icon name="heart" active></motion-state-icon>
 * ```
 */
@customElement('motion-state-icon')
export class MotionStateIcon extends LitElement implements MotionStateIconProps {
  /** Which icon: `'menu'`, `'play'`, `'copy'`, `'plus'`, `'chevron'`, `'heart'`, `'loading'` or `'eye'`. */
  @property({ type: String, reflect: true }) name: StateIconName = 'menu'
  /** The second state: close, pause, check, minus, up, filled, done or eye-off. */
  @property({ type: Boolean, converter: flag, reflect: true }) active = false
  /** Makes the icon a button that switches `active` on click, Space or Enter. */
  @property({ type: Boolean, converter: flag, reflect: true }) toggle = false
  /** Accessible name. Without it (and without `toggle`) the icon is decorative. */
  @property({ type: String }) label = ''
  /** Spring duration of the morph, in seconds. */
  @property({ type: Number }) duration = 0.45
  /** Spring bounciness of the morph (0 = no overshoot). */
  @property({ type: Number }) bounce = 0.3

  static styles = css`
    :host {
      display: inline-block;
      width: var(--icon-size, 1.5em);
      height: var(--icon-size, 1.5em);
      color: var(--icon-color, inherit);
      line-height: 0;
      vertical-align: middle;
      --_accent: currentColor;
    }
    :host([name='heart']) {
      --_accent: #e11d48;
    }
    :host([name='copy']),
    :host([name='loading']) {
      --_accent: #16a34a;
    }
    :host([toggle]) {
      cursor: pointer;
      border-radius: 4px;
    }
    :host([toggle]:focus-visible) {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }
    svg {
      width: 100%;
      height: 100%;
      overflow: visible;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    svg * {
      transform-box: fill-box;
      transform-origin: center;
    }
    .dash {
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
    }
    .accent {
      stroke: var(--icon-accent, var(--_accent));
    }
    .fill {
      fill: var(--icon-accent, var(--_accent));
      fill-opacity: 0;
    }
  `

  private spin: AnimationPlaybackControls | null = null

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  connectedCallback() {
    super.connectedCallback()
    this.addEventListener('click', this.onClick)
    this.addEventListener('keydown', this.onKey)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener('click', this.onClick)
    this.removeEventListener('keydown', this.onKey)
    this.spin?.stop()
    this.spin = null
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('toggle') || changed.has('label') || changed.has('active')) this.applyRole()
    if (changed.has('name') || changed.has('active')) {
      const first = changed.has('name') || changed.get('active') === undefined
      this.pose(first || this.reduced)
      this.updateSpin()
    }
  }

  private applyRole() {
    const name = this.label || (this.toggle ? this.name : '')
    if (this.toggle) {
      this.setAttribute('role', 'button')
      this.setAttribute('aria-pressed', String(this.active))
      if (!this.hasAttribute('tabindex')) this.tabIndex = 0
    } else {
      this.removeAttribute('aria-pressed')
      this.setAttribute('role', this.label ? 'img' : 'presentation')
    }
    if (name) {
      this.setAttribute('aria-label', name)
      this.removeAttribute('aria-hidden')
    } else {
      this.removeAttribute('aria-label')
      this.setAttribute('aria-hidden', 'true')
    }
  }

  private pose(instant: boolean) {
    const def = ICONS[this.name]
    if (!def) return
    const targets = this.active ? def.on : def.off
    for (const [part, keyframes] of Object.entries(targets)) {
      const el = this.renderRoot.querySelector(`.${part}`)
      if (!el) continue
      const drawn = 'strokeDashoffset' in keyframes || 'opacity' in keyframes
      const values = instant
        ? Object.fromEntries(
            Object.entries(keyframes).map(([k, v]) => [k, Array.isArray(v) ? v[v.length - 1] : v]),
          )
        : keyframes
      animate(
        el,
        values,
        instant
          ? { duration: 0 }
          : { type: 'spring', duration: this.duration, bounce: drawn ? 0 : this.bounce },
      )
    }
  }

  private updateSpin() {
    const part = ICONS[this.name]?.spin
    const el = part ? this.renderRoot.querySelector(`.${part}`) : null
    const shouldSpin = Boolean(el) && !this.active && !this.reduced
    if (shouldSpin && !this.spin) {
      this.spin = animate(
        el!,
        { rotate: [0, 360] },
        { duration: 0.9, repeat: Infinity, ease: 'linear' },
      )
    } else if (!shouldSpin && this.spin) {
      this.spin.stop()
      this.spin = null
    }
  }

  private flip() {
    this.active = !this.active
    this.dispatchEvent(
      new CustomEvent<StateIconChangeDetail>('motion-change', {
        detail: { active: this.active },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private onClick = () => {
    if (this.toggle) this.flip()
  }

  private onKey = (e: KeyboardEvent) => {
    if (!this.toggle || (e.key !== ' ' && e.key !== 'Enter')) return
    e.preventDefault()
    this.flip()
  }

  render() {
    const def = ICONS[this.name]
    return html`<svg viewBox="0 0 24 24" aria-hidden="true">${def ? def.shapes : nothing}</svg>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-state-icon': MotionStateIcon
  }
}
