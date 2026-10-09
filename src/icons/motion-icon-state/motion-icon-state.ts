import { LitElement, html, css, nothing } from 'lit'
import { property } from 'lit/decorators.js'
import { animate } from 'motion'
import type { AnimationPlaybackControls } from 'motion'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'
import { isLoopPaused, registerLoop, unregisterLoop } from '../../utils/registry.js'
import { ICONS } from './icons.js'
import type {
  MotionIconStateProps,
  IconStateChangeDetail,
  IconStateName,
} from './motion-icon-state.types.js'

export type {
  MotionIconStateProps,
  IconStateChangeDetail,
  IconStateName,
} from './motion-icon-state.types.js'
export type { MotionChangeDetail } from '../../utils/events.js'

/**
 * An icon that morphs between two states with spring physics: menu and close,
 * play and pause, copy and check, plus and minus, chevron down and up, an empty
 * and a filled heart, loading and done, and eye and eye-off. Drawn on a 24 px
 * grid with 2 px round strokes, so it sits next to Lucide, Tabler and Heroicons.
 *
 * **Use it for:** controls and indicators that switch between two states,
 * such as a menu button, a play and pause control, a copy button that
 * confirms, or a like button.
 *
 * **Avoid it for:** icons outside the eight built-in pairs, or icons that
 * only animate on hover or on scroll; use `motion-icon`, which takes any SVG.
 *
 * **Accessibility:** with `toggle`, the icon gets `role="button"`,
 * `aria-pressed` that follows `active`, and `tabindex="0"` unless you set
 * one. Space and Enter switch it, and keyboard focus shows an outline.
 * `label` becomes the `aria-label`; without it, a toggle logs a warning and
 * falls back to the icon name, such as "menu". Without `toggle`, a `label`
 * gives the icon `role="img"`, and no `label` hides it from screen readers.
 *
 * **Reduced motion:** the icon switches to the new state at once, with no
 * morph, and the loading spinner does not spin.
 *
 * **Common mistakes:** setting `toggle` on an icon inside your own
 * `<button>`, which puts one button inside another; leave out `toggle` and
 * `label`, name the button, and set `active` from your code. Using a label
 * that fits only one state, such as "Open menu": the label does not change,
 * and `aria-pressed` already reports the state, so use a name such as "Menu".
 *
 * @element motion-icon-state
 *
 * @fires motion-change - When a click, key or `flip()` switches the state. Setting `active` does not fire it. `detail: { active }`.
 *
 * @cssprop --mc-icon-size - Width and height of the icon. Default `1.5em`.
 * @cssprop --mc-icon-color - Line color. Default `currentColor`.
 * @cssprop --mc-icon-color-active - Color of the icon in its second state, when `active` is set, including the filled heart and the copy and loading checks. Default `--mc-icon-color`.
 *
 * @example
 * ```html
 * <motion-icon-state name="menu" toggle label="Menu"></motion-icon-state>
 * <motion-icon-state name="heart" active></motion-icon-state>
 * ```
 */
@customElement('motion-icon-state')
export class MotionIconState extends LitElement implements MotionIconStateProps {
  /** Which icon: `'menu'`, `'play'`, `'copy'`, `'plus'`, `'chevron'`, `'heart'`, `'loading'` or `'eye'`. */
  @property({ type: String, reflect: true }) name: IconStateName = 'menu'
  /** The second state: close, pause, check, minus, up, filled, done or eye-off. */
  @property({ type: Boolean, converter: flag, reflect: true }) active = false
  /** Makes the icon a button that switches `active` on click, Space or Enter. */
  @property({ type: Boolean, converter: flag, reflect: true }) toggle = false
  /** Accessible name. Without it (and without `toggle`) the icon is decorative. Required with `toggle`; a missing label logs a warning. */
  @property({ type: String }) label = ''
  /** Spring duration of the morph, in seconds. */
  @property({ type: Number }) duration = 0.45
  /** Spring bounciness of the morph (0 = no overshoot). */
  @property({ type: Number }) bounce = 0.3

  static styles = css`
    :host {
      display: inline-block;
      width: var(--mc-icon-size, 1.5em);
      height: var(--mc-icon-size, 1.5em);
      color: var(--mc-icon-color, inherit);
      line-height: 0;
      vertical-align: middle;
    }
    :host([active]) svg {
      color: var(--mc-icon-color-active, inherit);
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
      stroke-dasharray: 1 2;
      stroke-dashoffset: 1.05;
    }
    .fill {
      fill: currentColor;
      fill-opacity: 0;
    }
  `

  private spin: AnimationPlaybackControls | null = null

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  connectedCallback() {
    super.connectedCallback()
    registerLoop(this, () => this.spin)
    this.addEventListener('click', this.onClick)
    this.addEventListener('keydown', this.onKey)
    if (this.hasUpdated) this.updateSpin()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    unregisterLoop(this)
    this.removeEventListener('click', this.onClick)
    this.removeEventListener('keydown', this.onKey)
    this.spin?.stop()
    this.spin = null
  }

  private warned = false

  updated(changed: Map<string, unknown>) {
    if (changed.has('toggle') || changed.has('label') || changed.has('active')) this.applyRole()
    if (changed.has('name') || changed.has('active')) {
      const first = changed.has('name') || changed.get('active') === undefined
      this.pose(first || this.reduced)
      this.updateSpin()
    }
  }

  private applyRole() {
    if (this.toggle && !this.label && !this.warned) {
      this.warned = true
      console.warn(
        `<motion-icon-state toggle> needs a label so screen readers announce what it does. Falling back to "${this.name}".`,
        this,
      )
    }
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
      if (isLoopPaused(this)) this.spin.pause()
    } else if (!shouldSpin && this.spin) {
      this.spin.stop()
      this.spin = null
    }
  }

  /** Switches `active` and fires `motion-change`, as a click on a `toggle` icon does. */
  flip() {
    this.active = !this.active
    this.dispatchEvent(
      new CustomEvent<IconStateChangeDetail>('motion-change', {
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
    'motion-icon-state': MotionIconState
  }
}
