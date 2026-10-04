import { html, type TemplateResult } from 'lit'
import { wordParts } from './word-parts.js'

/** Renders one span per character in unbreakable groups, so lines break between words (or after a hyphen) and never between two letters. */
export const charsByWord = (text: string, char: (c: string) => TemplateResult) =>
  text
    .split(/(\s+)/)
    .filter(Boolean)
    .map((part) =>
      /^\s+$/.test(part)
        ? ' '
        : wordParts(part).map((piece) => html`<span class="word">${[...piece].map(char)}</span>`),
    )
