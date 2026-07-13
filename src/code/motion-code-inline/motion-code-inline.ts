import type { MotionCodeInlineProps } from './motion-code-inline.types.js'
export type { MotionCodeInlineProps } from './motion-code-inline.types.js'

import { LitElement, html, css, svg, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

@customElement('motion-code-inline')
export class MotionCodeInline extends LitElement implements MotionCodeInlineProps {
  @property({ type: Boolean }) copy = false
  @property({ type: Boolean, attribute: 'copy-visible', reflect: true }) copyVisible = false

  @state() private copied = false

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.3em;
      vertical-align: middle;
    }

    code {
      font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
      font-size: 0.875em;
      color: var(--color-accent, #2563eb);
      background: var(--color-accent-dim, #2563eb18);
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
      color: var(--color-muted, #60608a);
      border-radius: 4px;
      opacity: 0;
      transition:
        opacity 0.15s,
        color 0.15s;
      line-height: 1;
    }

    :host(:hover) button,
    :host([copy-visible]) button {
      opacity: 1;
    }

    button:hover {
      color: var(--color-accent, #2563eb);
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
