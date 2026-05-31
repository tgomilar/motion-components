import { LitElement, html, css } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import { animate } from 'motion'
import type { MotionDialogProps } from './motion-dialog.types.js'

export type { MotionDialogProps } from './motion-dialog.types.js'

/**
 * Animated modal dialog. Slides up with spring physics on open, springs back
 * down on close. Built on the native `<dialog>` element for top-layer stacking
 * and built-in accessibility. Open/close via the `open` attribute or `show()`
 * / `close()` methods.
 *
 * @element motion-dialog
 *
 * @slot - Content rendered inside the dialog panel.
 *
 * @fires motion-close - Dispatched after the close animation completes.
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
  @property({ type: Boolean, reflect: true }) open = false
  /** Spring duration for enter/exit animations, in seconds. */
  @property({ type: Number }) duration = 0.5
  /** Spring bounciness (0 = critically damped, higher = more elastic). */
  @property({ type: Number }) bounce = 0.25
  /** Initial vertical offset for the slide-up entrance, in pixels. */
  @property({ type: Number }) y = 40
  /** When present, the dimmed/blurred overlay is hidden. The dialog floats without a backdrop. */
  @property({ type: Boolean, attribute: 'no-backdrop', reflect: true }) noBackdrop = false
  /** When present, clicking the backdrop outside the panel closes the dialog. */
  @property({ type: Boolean, attribute: 'light-dismiss' }) lightDismiss = false

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
      background: var(--dialog-backdrop-color, rgba(0, 0, 0, 0.48));
      backdrop-filter: var(--dialog-backdrop-blur, blur(6px));
      -webkit-backdrop-filter: var(--dialog-backdrop-blur, blur(6px));
      opacity: 0;
      pointer-events: none;
    }

    dialog {
      border: none;
      border-radius: var(--dialog-radius, 16px);
      padding: var(--dialog-padding, 2rem);
      max-width: var(--dialog-max-width, min(560px, calc(100vw - 2rem)));
      max-height: var(--dialog-max-height, calc(100dvh - 4rem));
      overflow: auto;
      background: var(--dialog-bg, var(--color-surface, Canvas));
      color: var(--dialog-color, var(--color-text, CanvasText));
      box-shadow: var(
        --dialog-shadow,
        0 8px 32px rgba(0, 0, 0, 0.18),
        0 0 0 1px var(--color-border, rgba(0, 0, 0, 0.08))
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
  // shadow DOM retargeting. getBoundingClientRect distinguishes panel from backdrop.
  private onDocumentClick = (e: MouseEvent) => {
    if (!this.lightDismiss || !this.dialogEl?.open) return
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
    if (!dialog || dialog.open) return

    dialog.showModal()

    if (this.reduced) {
      if (!this.noBackdrop) backdropEl.style.opacity = '1'
      dialog.style.opacity = '1'
      return
    }

    if (!this.noBackdrop) {
      animate(
        backdropEl,
        { opacity: [0, 1] },
        { type: 'spring', bounce: 0, duration: this.duration },
      )
    }
    animate(
      dialog,
      { opacity: [0, 1], y: [this.y, 0] },
      { type: 'spring', bounce: this.bounce, duration: this.duration },
    )
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
