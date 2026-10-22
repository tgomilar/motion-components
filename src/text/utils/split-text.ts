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
        `<span style="display:inline-block;white-space:nowrap" aria-hidden="true" translate="no">${[...part].map(char).join('')}</span>`,
    )
    .join('')

/** Renders the full text in a span that screen readers read and nobody sees, since the split pieces are `aria-hidden`. */
export const screenReaderText = (text: string) =>
  `<span data-label style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;user-select:none">${escapeHtml(text)}</span>`

/** Replaces everything in `el` except the screen reader label with `pieces`, and adds the label the first time. */
export function setPieces(el: HTMLElement, text: string, pieces: string) {
  const label = el.querySelector(':scope > [data-label]')
  for (const node of [...el.childNodes]) if (node !== label) node.remove()
  if (!label) el.insertAdjacentHTML('afterbegin', screenReaderText(text))
  el.insertAdjacentHTML('beforeend', pieces)
}

/**
 * Calls `update` with the new text when a page translator rewrites the screen
 * reader label. The split pieces are `translate="no"`, because a translator
 * rewriting them one by one repeats and scrambles the words, so the component
 * splits the translated label again instead.
 */
export function watchLabel(el: HTMLElement, update: (text: string) => void) {
  const label = el.querySelector(':scope > [data-label]')
  if (!label) return
  let text = label.textContent?.trim() ?? ''
  new MutationObserver(() => {
    const next = label.textContent?.trim() ?? ''
    if (!next || next === text) return
    text = next
    update(next)
  }).observe(label, { characterData: true, childList: true, subtree: true })
}

export type SplitMode = 'chars' | 'words' | 'lines'

export interface SplitTextResult {
  spans: HTMLElement[]
  originalText: string
}

export function splitText(
  el: HTMLElement,
  by: SplitMode,
  masked = false,
  originalText = el.textContent?.trim() ?? '',
): SplitTextResult {
  if (!originalText) return { spans: [], originalText }

  const pieces =
    by === 'lines' ? _lineMarkup(el, originalText, masked) : _unitMarkup(originalText, by, masked)
  setPieces(el, originalText, pieces)
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
          `<span style="display:inline-block;overflow:hidden;vertical-align:bottom" aria-hidden="true" translate="no"><span data-unit style="display:inline-block;will-change:transform;transform:translateY(110%)">${escapeHtml(u)}</span></span>`,
      )
      .join(' ')
  }

  return units
    .map(
      (u) =>
        `<span data-unit style="display:inline-block;will-change:transform,opacity;opacity:0" aria-hidden="true" translate="no">${escapeHtml(u)}</span>`,
    )
    .join(' ')
}

function _lineMarkup(el: HTMLElement, originalText: string, masked: boolean) {
  const words = originalText.split(/\s+/)

  setPieces(
    el,
    originalText,
    words.map((w) => `<span data-measure style="display:inline">${escapeHtml(w)}</span>`).join(' '),
  )

  const wordSpans = [...el.querySelectorAll<HTMLElement>('[data-measure]')]
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
        return `<span style="display:block;overflow:hidden;vertical-align:bottom" aria-hidden="true" translate="no"><span data-unit style="display:block;will-change:transform;transform:translateY(110%)">${escapeHtml(text)}</span></span>`
      })
      .join('')
  }

  return lines
    .map((lineWords) => {
      const text = lineWords.join(' ')
      return `<span data-unit style="display:block;will-change:transform,opacity;opacity:0" aria-hidden="true" translate="no">${escapeHtml(text)}</span>`
    })
    .join('')
}
