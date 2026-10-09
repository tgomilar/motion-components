import type { MotionCodeInlineProps } from './motion-code-inline.types.js'
import { customElement } from '../../utils/define.js'
import { flag } from '../../utils/attributes.js'
export type { MotionCodeInlineProps } from './motion-code-inline.types.js'

import { LitElement, html, css, nothing } from 'lit'
import { property, state } from 'lit/decorators.js'
import '../../icons/motion-icon-state/motion-icon-state.js'

/**
 * Inline code snippet with an optional copy-to-clipboard button. Renders the
 * slotted text inside a styled `<code>` element; the copy button fades in on
 * hover, or stays visible with `copy-visible`. The copy icon is a
 * `motion-icon-state` that morphs into a check after copying, and it scales
 * with the text.
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
 * **Reduced motion:** the copy icon switches to the check at once, with no
 * morph. The copy button keeps its short 0.15 s CSS fade on hover.
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
 * @cssprop --mc-icon-color-active - Color of the check after copying. Default the copy button color.
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
      font: inherit;
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

    motion-icon-state {
      --mc-icon-size: 1em;
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

  render() {
    return html`
      <code><slot></slot></code>
      ${this.copy || this.copyVisible
        ? html`<button @click=${this.doCopy} aria-label=${this.copied ? 'Copied' : 'Copy'}>
            <motion-icon-state name="copy" .active=${this.copied}></motion-icon-state>
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
