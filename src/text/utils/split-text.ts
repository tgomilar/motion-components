import { wordParts } from './word-parts.js'

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Escapes text for safe insertion into an HTML string. */
export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ESCAPES[c])

/** Renders a word's characters in unbreakable groups, so text wraps between words (or after a hyphen) and never between two letters. */
export const wordGroup = (word: string, char: (c: string) => string) =>
  wordParts(word)
    .map(
      (part) =>
        `<span style="display:inline-block;white-space:nowrap" aria-hidden="true">${[...part].map(char).join('')}</span>`,
    )
    .join('')

/** Renders the full text in a span that screen readers read and nobody sees, since the split pieces are `aria-hidden`. */
export const screenReaderText = (text: string) =>
  `<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;user-select:none">${escapeHtml(text)}</span>`

export type SplitMode = 'chars' | 'words' | 'lines'

export interface SplitTextResult {
  spans: HTMLElement[]
  originalText: string
}

export function splitText(el: HTMLElement, by: SplitMode, masked = false): SplitTextResult {
  const originalText = el.textContent?.trim() ?? ''
  if (!originalText) return { spans: [], originalText }

  const pieces =
    by === 'lines' ? _lineMarkup(el, originalText, masked) : _unitMarkup(originalText, by, masked)
  el.innerHTML = screenReaderText(originalText) + pieces
  return { spans: [...el.querySelectorAll<HTMLElement>('[data-unit]')], originalText }
}

function _unitMarkup(originalText: string, by: 'chars' | 'words', masked: boolean) {
  const units = originalText.split(/\s+/)

  if (by === 'chars') {
    if (masked) {
      return units
        .map((w) =>
          wordGroup(
            w,
            (c) =>
              `<span style="display:inline-block;overflow:hidden;vertical-align:bottom"><span data-unit style="display:inline-block;will-change:transform;transform:translateY(110%)">${escapeHtml(c)}</span></span>`,
          ),
        )
        .join(' ')
    }
    return units
      .map((w) =>
        wordGroup(
          w,
          (c) =>
            `<span data-unit style="display:inline-block;will-change:transform,opacity;opacity:0">${escapeHtml(c)}</span>`,
        ),
      )
      .join(' ')
  }

  if (masked) {
    return units
      .map(
        (u) =>
          `<span style="display:inline-block;overflow:hidden;vertical-align:bottom" aria-hidden="true"><span data-unit style="display:inline-block;will-change:transform;transform:translateY(110%)">${escapeHtml(u)}</span></span>`,
      )
      .join(' ')
  }

  return units
    .map(
      (u) =>
        `<span data-unit style="display:inline-block;will-change:transform,opacity;opacity:0" aria-hidden="true">${escapeHtml(u)}</span>`,
    )
    .join(' ')
}

function _lineMarkup(el: HTMLElement, originalText: string, masked: boolean) {
  const words = originalText.split(/\s+/)

  el.innerHTML = words.map((w) => `<span style="display:inline">${escapeHtml(w)}</span>`).join(' ')

  const wordSpans = [...el.querySelectorAll<HTMLElement>('span')]
  const lineMap = new Map<number, string[]>()

  wordSpans.forEach((span) => {
    const top = Math.round(span.getBoundingClientRect().top)
    if (!lineMap.has(top)) lineMap.set(top, [])
    lineMap.get(top)!.push(span.textContent ?? '')
  })

  const lines = [...lineMap.values()]

  if (masked) {
    return lines
      .map((lineWords) => {
        const text = lineWords.join(' ')
        return `<span style="display:block;overflow:hidden;vertical-align:bottom" aria-hidden="true"><span data-unit style="display:block;will-change:transform;transform:translateY(110%)">${escapeHtml(text)}</span></span>`
      })
      .join('')
  }

  return lines
    .map((lineWords) => {
      const text = lineWords.join(' ')
      return `<span data-unit style="display:block;will-change:transform,opacity;opacity:0" aria-hidden="true">${escapeHtml(text)}</span>`
    })
    .join('')
}
