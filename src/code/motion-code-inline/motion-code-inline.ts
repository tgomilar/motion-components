import type { MotionCodeInlineProps } from './motion-code-inline.types.js'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'
export type { MotionCodeInlineProps } from './motion-code-inline.types.js'

import { LitElement, html, css, svg, nothing } from 'lit'
import { property, state } from 'lit/decorators.js'

/**
 * Inline code snippet with an optional copy-to-clipboard button. Renders the
 * slotted text inside a styled `<code>` element; the copy button fades in on
 * hover, or stays visible with `copy-visible`.
 *
 * **Use it for:** short code inside running text, such as a command, a file
 * name, an attribute or a CSS variable, with an optional copy button.
 *
 * **Avoid it for:** code that spans more than one line or is long, because
 * it never wraps; use `motion-code` for blocks.
 *
 * **Accessibility:** the text is in a real `<code>` element. The copy button
 * is a native `<button>` named "Copy", which changes to "Copied" for 1.8
 * seconds after a click. With `copy` alone, the button stays transparent
 * until the pointer is over the component or the button has keyboard focus.
 * Set `copy-visible` to show it at all times.
 *
 * **Reduced motion:** nothing changes. The component uses no Motion One
 * animation; the copy button keeps its short 0.15 s CSS fade on hover.
 *
 * **Common mistakes:** putting a prompt such as `$ ` inside the element: the
 * button copies all of the element's text, prompt included. Expecting copy to
 * work on a page served over plain HTTP: the Clipboard API needs HTTPS or
 * localhost, so the button does nothing there.
 *
 * @element motion-code-inline
 *
 * @slot - The code text to render and copy.
 *
 * @cssprop [--mc-color-accent=#2563eb] - Code text color, and the copy button color on hover.
 * @cssprop [--mc-color-accent-dim=#2563eb18] - Background behind the code.
 * @cssprop [--mc-color-muted=#60608a] - Copy button color.
 *
 * @example
 * ```html
 * <motion-code-inline copy>npm i motion-components</motion-code-inline>
 * <motion-code-inline copy-visible>--mc-color-accent</motion-code-inline>
 * ```
 */
@customElement('motion-code-inline')
export class MotionCodeInline extends LitElement implements MotionCodeInlineProps {
  /** Show a copy-to-clipboard button that fades in on hover. */
  @property({ type: Boolean, converter: flag }) copy = false
  /** Show the copy button and keep it permanently visible, without needing hover. Implies `copy`. */
  @property({ type: Boolean, converter: flag, attribute: 'copy-visible', reflect: true })
  copyVisible = false

  @state() private copied = false

  static styles = css`
    :host {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 0.3em;
      vertical-align: middle;
    }

    code {
      font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
      font-size: 0.875em;
      color: var(--mc-color-accent, #2563eb);
      background: var(--mc-color-accent-dim, #2563eb18);
      padding: 0.15em 0.45em;
      border-radius: 5px;
      white-space: nowrap;
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      padding: 0.1em;
      cursor: pointer;
      color: var(--mc-color-muted, #60608a);
      border-radius: 4px;
      opacity: 0;
      transition:
        opacity 0.15s,
        color 0.15s;
      line-height: 1;
    }

    :host(:not([copy-visible])) button {
      position: absolute;
      left: 100%;
      margin-left: 0.2em;
    }

    :host(:hover) button,
    :host([copy-visible]) button,
    button:focus-visible {
      opacity: 1;
    }

    button:focus-visible {
      outline: 2px solid var(--mc-color-accent, #2563eb);
      outline-offset: 1px;
    }

    button:hover {
      color: var(--mc-color-accent, #2563eb);
    }

    button svg {
      width: 13px;
      height: 13px;
      display: block;
    }
  `

  private async doCopy() {
    const text = this.textContent?.trim() ?? ''
    await navigator.clipboard.writeText(text)
    this.copied = true
    setTimeout(() => {
      this.copied = false
    }, 1800)
  }

  private copyIcon() {
    if (this.copied) {
      return svg`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="2 8 6 12 14 4"/>
      </svg>`
    }
    return svg`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="5" y="5" width="9" height="9" rx="2"/>
      <path d="M11 5V3a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
    </svg>`
  }

  render() {
    return html`
      <code><slot></slot></code>
      ${this.copy || this.copyVisible
        ? html`<button @click=${this.doCopy} aria-label=${this.copied ? 'Copied' : 'Copy'}>
            ${this.copyIcon()}
          </button>`
        : nothing}
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-code-inline': MotionCodeInline
  }
}
