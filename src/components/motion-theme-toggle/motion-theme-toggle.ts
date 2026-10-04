import { LitElement, html, css, nothing } from 'lit'
import { property, query, state } from 'lit/decorators.js'
import { animate, animateView } from 'motion'
import '../../respond/motion-hover/motion-hover.js'
import '../../respond/motion-press/motion-press.js'
import '../motion-theme-icon/motion-theme-icon.js'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'
import {
  appliedScheme,
  applyScheme,
  darkQuery,
  isMode,
  osScheme,
  readStored,
  resolveScheme,
  resolveTarget,
  storageKey,
  writeStored,
} from './theme.js'
import type {
  ColorScheme,
  ColorSchemeChangeDetail,
  MotionThemeToggleProps,
  PermanentColorSchemeChangeDetail,
  ThemeAppearance,
  ThemeMode,
} from './motion-theme-toggle.types.js'

export type {
  ColorScheme,
  ColorSchemeChangeDetail,
  MotionThemeToggleProps,
  PermanentColorSchemeChangeDetail,
  ThemeAppearance,
  ThemeMode,
} from './motion-theme-toggle.types.js'

const MODES: ThemeMode[] = ['light', 'dark', 'system']
const peers = new Set<MotionThemeToggle>()
let uid = 0

/**
 * Light / dark mode control with an optional third "system" option. Applies
 * `data-theme` and `color-scheme` to a target element, follows the OS
 * preference, optionally remembers the choice, and can reveal the new theme
 * with a circular view-transition wipe from the control. API-compatible with
 * Google Chrome Labs' `dark-mode-toggle`.
 *
 * **Use it for:** letting people choose a light or dark theme, or follow the
 * system setting, for a whole site or for one part of a page.
 *
 * **Avoid it for:** sites with only one theme, and other on/off settings;
 * use a native checkbox for those. To only show the current theme as an
 * icon, use `motion-theme-icon`.
 *
 * **Accessibility:** `icon` and `switch` render a button with
 * `role="switch"`, where checked means dark. With `system`, `icon` is a plain
 * button whose label names the current mode, and each press moves to the
 * next mode. `toggle` is a native radio group in a `<fieldset>`; with
 * `icon-only` the labels stay available to screen readers. `menu` is a menu
 * button: the Up and Down arrow keys open it and move between items, Home
 * and End jump to the first and last item, and Escape closes it and returns
 * focus to the button. Without `legend` the name is "Dark" for `icon` and
 * `switch`, and "Theme" for `toggle` and `menu`, so set `legend` to a clear
 * name.
 *
 * **Reduced motion:** the theme changes at once and `wipe` is skipped. The
 * icon, the selection marker, the switch thumb and the menu change with no
 * animation, and the hover and press effects are off.
 *
 * **Common mistakes:** writing dark styles only in a
 * `prefers-color-scheme: dark` media query; the toggle cannot change that
 * query, so style `[data-theme="dark"]` on the target. Relying on the
 * component alone to apply a saved theme; it applies the theme only after it
 * loads, so add a small inline script in `<head>` to avoid a flash of the
 * wrong theme.
 *
 * @element motion-theme-toggle
 *
 * @fires colorschemechange - When the mode or applied color scheme changes. `detail: { colorScheme, mode }`.
 * @fires permanentcolorschemechange - When `permanent` changes. `detail: { permanent }`.
 *
 * @cssprop --theme-toggle-surface - Background of the switch track, segmented group and menu trigger.
 * @cssprop --theme-toggle-border - Border color of the controls.
 * @cssprop --theme-toggle-accent - Selected segment, switch thumb and active menu item background.
 * @cssprop --theme-toggle-menu-bg - Drop-down menu background. Default `Canvas`.
 * @cssprop --theme-toggle-radius - Corner radius of the controls. Default `999px`.
 * @cssprop --theme-icon-size - Icon size. Default `1.25em`.
 *
 * @csspart button - The icon button (`icon`) or menu trigger (`menu`).
 * @csspart track - The switch track (`switch`).
 * @csspart thumb - The switch thumb (`switch`).
 * @csspart segment - Each option of the segmented group (`toggle`).
 * @csspart menu - The drop-down panel (`menu`).
 * @csspart item - Each drop-down option (`menu`).
 *
 * @example
 * ```html
 * <motion-theme-toggle permanent></motion-theme-toggle>
 * <motion-theme-toggle appearance="menu" system></motion-theme-toggle>
 * <motion-theme-toggle wipe></motion-theme-toggle>
 * ```
 */
@customElement('motion-theme-toggle')
export class MotionThemeToggle extends LitElement implements MotionThemeToggleProps {
  /** Selected mode: `'light'`, `'dark'`, or `'system'` (requires `system`). Defaults to the OS preference. */
  @property({ type: String, reflect: true }) mode: ThemeMode = 'light'
  /** Visual style: `'icon'`, `'toggle'` (segmented), `'switch'`, or `'menu'` (drop-down). */
  @property({ type: String, reflect: true }) appearance: ThemeAppearance = 'icon'
  /** Offers a third "system" option that follows the OS preference. Ignored by `switch`. */
  @property({ type: Boolean, converter: flag, reflect: true }) system = false
  /** Remembers the choice in `localStorage` (`motion-theme`, or `motion-theme:<target>` for other targets) and restores it on load. */
  @property({ type: Boolean, converter: flag, reflect: true }) permanent = false
  /** Group label. Used as the accessible name of `icon`, `switch` and `menu`. */
  @property({ type: String }) legend = ''
  /** Label of the light option. */
  @property({ type: String }) light = 'Light'
  /** Label of the dark option. */
  @property({ type: String }) dark = 'Dark'
  /** Label of the system option. */
  @property({ type: String, attribute: 'system-label' }) systemLabel = 'System'
  /** When set, shows a checkbox with this label that toggles `permanent`. */
  @property({ type: String }) remember = ''
  /** CSS selector of the element that receives `data-theme` and `color-scheme`. */
  @property({ type: String }) target = 'html'
  /** Reveals the new theme with a circular view-transition wipe from the control. Off by default. */
  @property({ type: Boolean, converter: flag, reflect: true }) wipe = false
  /** Hides the option labels of the `toggle` appearance and shows icons only. Labels stay available to screen readers and as tooltips. */
  @property({ type: Boolean, converter: flag, attribute: 'icon-only', reflect: true }) iconOnly =
    false
  /** Spring duration of the icon morph and wipe, in seconds. */
  @property({ type: Number }) duration = 0.5
  /** Spring bounciness of the icon morph and controls. */
  @property({ type: Number }) bounce = 0.25

  @state() private scheme: ColorScheme = 'light'
  @state() private open = false

  @query('.panel') private panel?: HTMLElement
  @query('.trigger') private trigger?: HTMLButtonElement
  @query('.indicator') private indicator?: HTMLElement
  @query('.track') private track?: HTMLElement
  @query('.thumb') private thumb?: HTMLElement

  private readonly uid = `motion-theme-toggle-${++uid}`
  private committed = false
  private silent = false
  private emitted = ''
  private menuGeneration = 0
  private layout: ResizeObserver | null = null

  static styles = css`
    :host {
      display: inline-block;
      position: relative;
      --_surface: var(--theme-toggle-surface, color-mix(in srgb, currentColor 6%, transparent));
      --_border: var(--theme-toggle-border, color-mix(in srgb, currentColor 16%, transparent));
      --_accent: var(--theme-toggle-accent, color-mix(in srgb, currentColor 14%, transparent));
      --_radius: var(--theme-toggle-radius, 999px);
      --theme-icon-size: 1.25em;
    }
    .root {
      display: inline-flex;
      align-items: center;
      gap: 0.75em;
    }
    button {
      font: inherit;
      color: inherit;
      background: none;
      border: 0;
      padding: 0;
      cursor: pointer;
    }
    button:focus-visible,
    .segment:has(input:focus-visible) {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }
    .icon-button,
    .trigger {
      display: grid;
      place-items: center;
      width: 2.5em;
      height: 2.5em;
      border-radius: var(--_radius);
    }
    .trigger {
      background: var(--_surface);
      box-shadow: inset 0 0 0 1px var(--_border);
    }
    fieldset {
      border: 0;
      margin: 0;
      padding: 0;
      min-width: 0;
    }
    legend,
    .label {
      font-size: 0.875em;
      padding: 0;
      margin-bottom: 0.5em;
    }
    .segments {
      position: relative;
      display: inline-flex;
      padding: 3px;
      border-radius: var(--_radius);
      background: var(--_surface);
      box-shadow: inset 0 0 0 1px var(--_border);
    }
    .indicator {
      position: absolute;
      top: 3px;
      bottom: 3px;
      left: 0;
      width: 0;
      border-radius: var(--_radius);
      background: var(--_accent);
    }
    .segment {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 0.4em;
      padding: 0.4em 0.85em;
      border-radius: var(--_radius);
      cursor: pointer;
      user-select: none;
    }
    :host([icon-only]) .segment {
      padding: 0.45em 0.6em;
    }
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .segment input,
    .remember input:not(:focus-visible) {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }
    .switch {
      display: inline-flex;
      align-items: center;
      gap: 0.6em;
    }
    .switch .label {
      margin: 0;
      font-weight: 600;
    }
    .side {
      font-size: 0.875em;
    }
    .track {
      position: relative;
      width: 3.5em;
      height: 2em;
      border-radius: var(--_radius);
      background: var(--_surface);
      box-shadow: inset 0 0 0 1px var(--_border);
    }
    .thumb {
      position: absolute;
      top: 3px;
      left: 3px;
      display: grid;
      place-items: center;
      width: calc(2em - 6px);
      height: calc(2em - 6px);
      border-radius: var(--_radius);
      background: var(--_accent);
      --theme-icon-size: 1em;
    }
    .menu {
      position: relative;
    }
    .panel {
      position: absolute;
      top: calc(100% + 6px);
      inset-inline-end: 0;
      z-index: 10;
      display: grid;
      min-width: 10em;
      padding: 4px;
      border-radius: 12px;
      background: var(--theme-toggle-menu-bg, Canvas);
      box-shadow:
        0 8px 24px rgba(0, 0, 0, 0.16),
        0 0 0 1px var(--_border);
      transform-origin: top right;
    }
    .panel[hidden] {
      display: none;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 0.6em;
      padding: 0.5em 0.75em;
      border-radius: 8px;
      text-align: start;
    }
    .item:hover,
    .item:focus-visible {
      background: var(--_surface);
      outline: none;
    }
    .item[aria-checked='true'] {
      background: var(--_accent);
    }
    .remember {
      display: inline-flex;
      align-items: center;
      gap: 0.4em;
      font-size: 0.875em;
      cursor: pointer;
    }
    .remember input {
      position: static;
      opacity: 1;
      pointer-events: auto;
      margin: 0;
    }
  `

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  private get spring() {
    return this.reduced
      ? { duration: 0 }
      : { type: 'spring' as const, duration: this.duration, bounce: this.bounce }
  }

  private get modes() {
    return this.system && this.appearance !== 'switch' ? MODES : MODES.slice(0, 2)
  }

  connectedCallback() {
    super.connectedCallback()
    const stored = readStored(storageKey(this.target))
    if (stored) {
      this.mode = stored
      this.permanent = true
    } else if (!this.hasAttribute('mode')) {
      this.mode = this.system ? 'system' : osScheme()
    }
    peers.add(this)
    darkQuery().addEventListener('change', this.onSystemChange)
    window.addEventListener('storage', this.onStorage)
    if (this.hasUpdated) this.observeLayout()
    document.addEventListener('pointerdown', this.onOutside, true)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.layout?.disconnect()
    peers.delete(this)
    darkQuery().removeEventListener('change', this.onSystemChange)
    window.removeEventListener('storage', this.onStorage)
    document.removeEventListener('pointerdown', this.onOutside, true)
  }

  willUpdate() {
    if (!isMode(this.mode)) this.mode = 'light'
    if (this.mode === 'system' && !this.modes.includes('system')) this.mode = osScheme()
    this.scheme = resolveScheme(this.mode)
  }

  firstUpdated() {
    if (this.panel) animate(this.panel, { opacity: 0, y: -4, scale: 0.96 }, { duration: 0 })
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('appearance') || changed.has('system')) this.observeLayout()
    if (changed.has('mode') || changed.has('scheme') || changed.has('target')) this.commit()
    if (changed.has('permanent') && changed.get('permanent') !== undefined) this.persist()
    if (changed.has('open')) this.animateMenu()
    this.animateSelection(!changed.has('appearance') || changed.get('appearance') !== undefined)
  }

  private observeLayout() {
    this.layout ??= new ResizeObserver(() => this.animateSelection(false))
    for (const el of this.renderRoot.querySelectorAll('.segments, .track')) this.layout.observe(el)
  }

  private commit() {
    if (this.silent) {
      this.silent = false
    } else {
      if (this.committed && this.permanent) writeStored(storageKey(this.target), this.mode)
      const target = resolveTarget(this.target)
      const apply = () => applyScheme(target, this.scheme)
      if (this.committed && appliedScheme(target) !== this.scheme && this.canWipe())
        this.reveal(apply)
      else apply()
      if (this.committed)
        for (const peer of peers) {
          if (peer === this || peer.mode === this.mode || resolveTarget(peer.target) !== target)
            continue
          peer.silent = true
          peer.mode = this.mode
        }
    }
    this.committed = true
    const key = `${this.mode}:${this.scheme}`
    if (key === this.emitted) return
    this.emitted = key
    this.dispatchEvent(
      new CustomEvent<ColorSchemeChangeDetail>('colorschemechange', {
        detail: { colorScheme: this.scheme, mode: this.mode },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private persist() {
    writeStored(storageKey(this.target), this.permanent ? this.mode : null)
    this.dispatchEvent(
      new CustomEvent<PermanentColorSchemeChangeDetail>('permanentcolorschemechange', {
        detail: { permanent: this.permanent },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private canWipe() {
    return (
      this.wipe &&
      !this.reduced &&
      'startViewTransition' in document &&
      document.visibilityState === 'visible'
    )
  }

  private reveal(apply: () => void) {
    const rect = this.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    animateView(apply, { interrupt: 'immediate' }).new(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { type: 'spring', duration: this.duration, bounce: 0 },
    )
  }

  private animateMenu() {
    const panel = this.panel
    if (!panel) return
    const generation = ++this.menuGeneration
    if (this.open) {
      panel.hidden = false
      this.items()
        .find((item) => item.getAttribute('aria-checked') === 'true')
        ?.focus()
      animate(panel, { opacity: 1, y: 0, scale: 1 }, this.spring)
      return
    }
    animate(panel, { opacity: 0, y: -4, scale: 0.96 }, { ...this.spring, bounce: 0 }).then(() => {
      if (generation === this.menuGeneration) panel.hidden = true
    })
  }

  private animateSelection(animated: boolean) {
    const transition = animated ? this.spring : { duration: 0 }
    if (this.indicator) {
      const selected = this.renderRoot.querySelector<HTMLElement>(
        `.segment-wrap[data-mode='${this.mode}']`,
      )
      if (selected)
        animate(this.indicator, { x: selected.offsetLeft, width: selected.offsetWidth }, transition)
    }
    if (this.track && this.thumb) {
      const travel = this.track.clientWidth - this.thumb.offsetWidth - this.thumb.offsetLeft * 2
      animate(this.thumb, { x: this.scheme === 'dark' ? travel : 0 }, transition)
    }
  }

  private onSystemChange = () => {
    if (this.mode === 'system') this.requestUpdate()
    else if (!this.permanent) this.mode = osScheme()
  }

  private onStorage = (e: StorageEvent) => {
    if (e.key !== storageKey(this.target)) return
    if (isMode(e.newValue)) {
      this.permanent = true
      this.mode = e.newValue
    } else {
      this.permanent = false
    }
  }

  private onOutside = (e: PointerEvent) => {
    if (this.open && !e.composedPath().includes(this)) this.open = false
  }

  private select(mode: ThemeMode) {
    if (this.modes.includes(mode)) this.mode = mode
  }

  private cycle = () => {
    const modes = this.modes
    this.select(modes[(modes.indexOf(this.mode) + 1) % modes.length])
  }

  private flip = () => this.select(this.scheme === 'dark' ? 'light' : 'dark')

  private onRadio = (e: Event) => this.select((e.target as HTMLInputElement).value as ThemeMode)

  private onRemember = (e: Event) => (this.permanent = (e.target as HTMLInputElement).checked)

  private toggleMenu = () => (this.open = !this.open)

  private onItem = (e: Event) => {
    this.select((e.currentTarget as HTMLElement).dataset.mode as ThemeMode)
    this.closeMenu(true)
  }

  private items() {
    return [...this.renderRoot.querySelectorAll<HTMLElement>('.item')]
  }

  private closeMenu(refocus: boolean) {
    this.open = false
    if (refocus) this.trigger?.focus()
  }

  private onTriggerKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    this.open = true
  }

  private onMenuKey = (e: KeyboardEvent) => {
    const items = this.items()
    const index = items.indexOf(e.target as HTMLElement)
    const focus = (i: number) => items[(i + items.length) % items.length]?.focus()
    if (e.key === 'Tab') return void (this.open = false)
    if (e.key === 'ArrowDown') focus(index + 1)
    else if (e.key === 'ArrowUp') focus(index - 1)
    else if (e.key === 'Home') focus(0)
    else if (e.key === 'End') focus(items.length - 1)
    else if (e.key === 'Escape') this.closeMenu(true)
    else return
    e.preventDefault()
  }

  private labelFor(mode: ThemeMode) {
    return mode === 'light' ? this.light : mode === 'dark' ? this.dark : this.systemLabel
  }

  private icon(mode: ThemeMode) {
    return html`<motion-theme-icon
      mode=${mode}
      duration=${this.duration}
      bounce=${this.bounce}
    ></motion-theme-icon>`
  }

  private renderIcon() {
    const name = this.legend || 'Theme'
    const button = this.system
      ? html`<button
          class="icon-button"
          part="button"
          aria-label="${name}: ${this.labelFor(this.mode)}"
          @click=${this.cycle}
        >
          ${this.icon(this.mode)}
        </button>`
      : html`<button
          class="icon-button"
          part="button"
          role="switch"
          aria-checked=${this.scheme === 'dark'}
          aria-label=${this.legend || this.dark}
          @click=${this.cycle}
        >
          ${this.icon(this.mode)}
        </button>`
    return html`<motion-hover scale="1.08" bounce=${this.bounce}
      ><motion-press>${button}</motion-press></motion-hover
    >`
  }

  private renderToggle() {
    return html`
      <fieldset aria-label=${this.legend ? nothing : 'Theme'}>
        ${this.legend ? html`<legend>${this.legend}</legend>` : nothing}
        <div class="segments">
          <span class="indicator"></span>
          ${this.modes.map(
            (mode) => html`
              <motion-press class="segment-wrap" data-mode=${mode}>
                <label
                  class="segment"
                  part="segment"
                  title=${this.iconOnly ? this.labelFor(mode) : nothing}
                >
                  <input
                    type="radio"
                    name=${this.uid}
                    .value=${mode}
                    .checked=${mode === this.mode}
                    @change=${this.onRadio}
                  />
                  ${this.icon(mode)}
                  <span class=${this.iconOnly ? 'visually-hidden' : ''}
                    >${this.labelFor(mode)}</span
                  >
                </label>
              </motion-press>
            `,
          )}
        </div>
      </fieldset>
    `
  }

  private renderSwitch() {
    return html`
      <div class="switch">
        ${this.legend
          ? html`<span class="label" id="${this.uid}-label">${this.legend}</span>`
          : nothing}
        <span class="side" aria-hidden="true">${this.light}</span>
        <motion-press>
          <button
            class="track"
            part="track"
            role="switch"
            aria-checked=${this.scheme === 'dark'}
            aria-label=${this.legend ? nothing : this.dark}
            aria-labelledby=${this.legend ? `${this.uid}-label` : nothing}
            @click=${this.flip}
          >
            <span class="thumb" part="thumb">${this.icon(this.scheme)}</span>
          </button>
        </motion-press>
        <span class="side" aria-hidden="true">${this.dark}</span>
      </div>
    `
  }

  private renderMenu() {
    const name = this.legend || 'Theme'
    return html`
      <div class="menu">
        <motion-hover scale="1.05" bounce=${this.bounce}>
          <motion-press>
            <button
              class="trigger"
              part="button"
              aria-haspopup="menu"
              aria-expanded=${this.open}
              aria-controls="${this.uid}-menu"
              aria-label="${name}: ${this.labelFor(this.mode)}"
              @click=${this.toggleMenu}
              @keydown=${this.onTriggerKey}
            >
              ${this.icon(this.mode)}
            </button>
          </motion-press>
        </motion-hover>
        <div
          class="panel"
          part="menu"
          role="menu"
          id="${this.uid}-menu"
          aria-label=${name}
          hidden
          @keydown=${this.onMenuKey}
        >
          ${this.modes.map(
            (mode) => html`
              <button
                class="item"
                part="item"
                role="menuitemradio"
                tabindex="-1"
                data-mode=${mode}
                aria-checked=${mode === this.mode}
                @click=${this.onItem}
              >
                ${this.icon(mode)}
                <span>${this.labelFor(mode)}</span>
              </button>
            `,
          )}
        </div>
      </div>
    `
  }

  private renderRemember() {
    if (!this.remember) return nothing
    return html`
      <label class="remember">
        <input type="checkbox" .checked=${this.permanent} @change=${this.onRemember} />
        ${this.remember}
      </label>
    `
  }

  render() {
    const control =
      this.appearance === 'toggle'
        ? this.renderToggle()
        : this.appearance === 'switch'
          ? this.renderSwitch()
          : this.appearance === 'menu'
            ? this.renderMenu()
            : this.renderIcon()
    return html`<div class="root">${control}${this.renderRemember()}</div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-theme-toggle': MotionThemeToggle
  }
  interface HTMLElementEventMap {
    colorschemechange: CustomEvent<ColorSchemeChangeDetail>
    permanentcolorschemechange: CustomEvent<PermanentColorSchemeChangeDetail>
  }
}
