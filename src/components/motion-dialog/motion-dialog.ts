import { LitElement, html, css } from 'lit'
import { property, query } from 'lit/decorators.js'
import { animate } from 'motion'
import type { MotionDialogProps } from './motion-dialog.types.js'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'

export type { MotionDialogProps } from './motion-dialog.types.js'

/**
 * Animated modal dialog. Slides up with spring physics on open, springs back
 * down on close. Built on the native `<dialog>` element for top-layer stacking
 * and built-in accessibility. Open/close via the `open` attribute or `show()`
 * / `close()` methods.
 *
 * **Use it for:** confirmations, short forms and focused tasks that must
 * block the rest of the page until the person responds.
 *
 * **Avoid it for:** hints, menus or notes that should not block the page; use
 * the native `popover` attribute or `<details>` for those. To enlarge images
 * from a grid, use `motion-gallery`, which has its own lightbox.
 *
 * **Accessibility:** it opens a native `<dialog>` with `showModal()`, so the
 * browser moves focus into the dialog and makes the rest of the page inert.
 * Escape closes it with the exit animation. The component gives the dialog
 * no accessible name, so start the content with a clear heading, and always
 * include a visible close button.
 *
 * **Reduced motion:** the panel and the backdrop appear and disappear at
 * once, with no slide or fade. `motion-close` still fires after the dialog
 * closes.
 *
 * **Common mistakes:** listening for the native `close` event on
 * `motion-dialog`; it does not reach the host, so listen for `motion-close`.
 * Expecting a click outside the panel to close the dialog; that only happens
 * with `light-dismiss`.
 *
 * @element motion-dialog
 *
 * @slot - Content rendered inside the dialog panel.
 *
 * @fires motion-close - Dispatched after the close animation completes.
 *
 * @cssprop --mc-dialog-bg - Panel background. Default `Canvas`.
 * @cssprop --mc-dialog-color - Panel text color. Default `CanvasText`.
 * @cssprop --mc-dialog-radius - Panel corner radius. Default `16px`.
 * @cssprop --mc-dialog-padding - Panel padding. Default `2rem`.
 * @cssprop --mc-dialog-max-width - Maximum panel width. Default `min(560px, 100vw - 2rem)`.
 * @cssprop --mc-dialog-max-height - Maximum panel height. Default `100dvh - 4rem`.
 * @cssprop --mc-dialog-shadow - Panel box shadow.
 * @cssprop --mc-dialog-backdrop-color - Backdrop overlay color. Default `rgba(0, 0, 0, 0.48)`.
 * @cssprop --mc-dialog-backdrop-blur - Backdrop `backdrop-filter`. Default `blur(6px)`.
 *
 * @example
 * ```html
 * <button onclick="document.querySelector('#dlg').show()">Open</button>
 *
 * <motion-dialog id="dlg">
 *   <h2>Hello</h2>
 *   <p>Spring-animated modal dialog.</p>
 *   <button onclick="this.closest('motion-dialog').close()">Close</button>
 * </motion-dialog>
 * ```
 */
// @preload host — preload uses display:none to prevent flash before dialog registration
@customElement('motion-dialog')
export class MotionDialog extends LitElement implements MotionDialogProps {
  /** Whether the dialog is open. Set this attribute to open declaratively. */
  @property({ type: Boolean, converter: flag, reflect: true }) open = false
  /** Spring duration for enter/exit animations, in seconds. */
  @property({ type: Number }) duration = 0.5
  /** Spring bounciness (0 = critically damped, higher = more elastic). */
  @property({ type: Number }) bounce = 0.25
  /** Initial vertical offset for the slide-up entrance, in pixels. */
  @property({ type: Number }) y = 40
  /** When present, the dimmed/blurred overlay is hidden. The dialog floats without a backdrop. */
  @property({ type: Boolean, converter: flag, attribute: 'no-backdrop', reflect: true })
  noBackdrop = false
  /** When present, clicking the backdrop outside the panel closes the dialog. */
  @property({ type: Boolean, converter: flag, attribute: 'light-dismiss' }) lightDismiss = false

  @query('dialog') private dialogEl!: HTMLDialogElement
  @query('.backdrop') private backdropEl!: HTMLElement

  static styles = css`
    :host {
      display: contents;
    }

    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 9998;
      background: var(--mc-dialog-backdrop-color, rgba(0, 0, 0, 0.48));
      backdrop-filter: var(--mc-dialog-backdrop-blur, blur(6px));
      -webkit-backdrop-filter: var(--mc-dialog-backdrop-blur, blur(6px));
      opacity: 0;
      pointer-events: none;
    }

    dialog {
      border: none;
      border-radius: var(--mc-dialog-radius, 16px);
      padding: var(--mc-dialog-padding, 2rem);
      max-width: var(--mc-dialog-max-width, min(560px, calc(100vw - 2rem)));
      max-height: var(--mc-dialog-max-height, calc(100dvh - 4rem));
      overflow: auto;
      background: var(--mc-dialog-bg, var(--mc-color-surface, Canvas));
      color: var(--mc-dialog-color, var(--mc-color-text, CanvasText));
      box-shadow: var(
        --mc-dialog-shadow,
        0 8px 32px rgba(0, 0, 0, 0.18),
        0 0 0 1px var(--mc-color-border, rgba(0, 0, 0, 0.08))
      );
      opacity: 0;
    }

    dialog::backdrop {
      display: none;
    }
  `

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  private generation = 0

  connectedCallback() {
    super.connectedCallback()
    document.addEventListener('click', this.onDocumentClick, true)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    document.removeEventListener('click', this.onDocumentClick, true)
  }

  // Capture-phase listener on document catches the backdrop click regardless of
  // shadow DOM retargeting. Clicks on panel content never dismiss, which covers
  // keyboard clicks reported at (0, 0). A click on the dialog itself lands on
  // its padding or its backdrop, and getBoundingClientRect tells them apart.
  private onDocumentClick = (e: MouseEvent) => {
    if (!this.lightDismiss || !this.dialogEl?.open) return
    const path = e.composedPath()
    if (path[0] !== this.dialogEl && path.includes(this.dialogEl)) return
    const rect = this.dialogEl.getBoundingClientRect()
    const inside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    if (!inside) this.open = false
  }

  updated(changed: Map<string, unknown>) {
    if (!changed.has('open')) return
    if (this.open) {
      this.animateIn()
    } else {
      this.animateOut()
    }
  }

  private animateIn() {
    const dialog = this.dialogEl
    const backdropEl = this.backdropEl
    if (!dialog) return

    this.generation++
    const reopening = dialog.open
    if (!reopening) dialog.showModal()

    if (this.reduced) {
      if (!this.noBackdrop) backdropEl.style.opacity = '1'
      dialog.style.opacity = '1'
      return
    }

    if (!this.noBackdrop) {
      animate(
        backdropEl,
        { opacity: reopening ? 1 : [0, 1] },
        { type: 'spring', bounce: 0, duration: this.duration },
      )
    }
    animate(dialog, reopening ? { opacity: 1, y: 0 } : { opacity: [0, 1], y: [this.y, 0] }, {
      type: 'spring',
      bounce: this.bounce,
      duration: this.duration,
    })
  }

  private async animateOut() {
    const dialog = this.dialogEl
    const backdropEl = this.backdropEl
    if (!dialog || !dialog.open) return

    const gen = ++this.generation

    if (this.reduced) {
      backdropEl.style.opacity = '0'
      dialog.style.opacity = '0'
    } else {
      const exitDuration = this.duration * 0.65
      await Promise.all([
        this.noBackdrop
          ? Promise.resolve()
          : animate(backdropEl, { opacity: 0 }, { ease: 'easeInOut', duration: exitDuration }),
        animate(
          dialog,
          { opacity: 0, y: this.y * 0.6 },
          {
            // Fade the panel on a clean easeIn (no spring tail, so letters don't
            // linger) and finish ahead of the backdrop. Keep the slide on a spring.
            opacity: { ease: 'easeIn', duration: exitDuration * 0.7 },
            y: { type: 'spring', bounce: 0, duration: exitDuration },
          },
        ),
      ])
    }

    if (this.generation !== gen) return

    dialog.close()
    this.dispatchEvent(new Event('motion-close', { bubbles: true, composed: true }))
  }

  /** Opens the dialog with the entrance animation. */
  show() {
    this.open = true
  }

  /** Closes the dialog with the exit animation. */
  close() {
    this.open = false
  }

  private onCancel = (e: Event) => {
    e.preventDefault()
    this.open = false
  }

  render() {
    return html`
      <div class="backdrop"></div>
      <dialog @cancel=${this.onCancel}>
        <slot></slot>
      </dialog>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-dialog': MotionDialog
  }
}
