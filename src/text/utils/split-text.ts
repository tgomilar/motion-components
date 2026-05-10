export type SplitMode = 'chars' | 'words' | 'lines'

export interface SplitTextResult {
  spans: HTMLElement[]
  originalText: string
}

export function splitText(el: HTMLElement, by: SplitMode, masked = false): SplitTextResult {
  const originalText = el.textContent?.trim() ?? ''
  if (!originalText) return { spans: [], originalText }

  el.setAttribute('aria-label', originalText)

  if (by === 'lines') return _splitByLines(el, originalText, masked)

  if (by === 'chars') {
    const words = originalText.split(/\s+/)
    if (masked) {
      el.innerHTML = words
        .map((w) =>
          [...w]
            .map(
              (c) =>
                `<span style="display:inline-block;overflow:hidden;vertical-align:bottom" aria-hidden="true"><span style="display:inline-block;will-change:transform;transform:translateY(110%)">${c}</span></span>`,
            )
            .join(''),
        )
        .join(' ')
      return { spans: [...el.querySelectorAll<HTMLElement>('span > span')], originalText }
    }
    el.innerHTML = words
      .map((w) =>
        [...w]
          .map(
            (c) =>
              `<span style="display:inline-block;will-change:transform,opacity;opacity:0" aria-hidden="true">${c}</span>`,
          )
          .join(''),
      )
      .join(' ')
    return { spans: [...el.querySelectorAll<HTMLElement>('span')], originalText }
  }

  const units = originalText.split(/\s+/)

  if (masked) {
    el.innerHTML = units
      .map(
        (u) =>
          `<span style="display:inline-block;overflow:hidden;vertical-align:bottom" aria-hidden="true"><span style="display:inline-block;will-change:transform;transform:translateY(110%)">${u}</span></span>`,
      )
      .join(' ')
    return { spans: [...el.querySelectorAll<HTMLElement>('span > span')], originalText }
  }

  el.innerHTML = units
    .map(
      (u) =>
        `<span style="display:inline-block;will-change:transform,opacity;opacity:0" aria-hidden="true">${u}</span>`,
    )
    .join(' ')
  return { spans: [...el.querySelectorAll<HTMLElement>('span')], originalText }
}

function _splitByLines(el: HTMLElement, originalText: string, masked: boolean): SplitTextResult {
  const words = originalText.split(/\s+/)

  el.innerHTML = words.map((w) => `<span style="display:inline">${w}</span>`).join(' ')

  const wordSpans = [...el.querySelectorAll<HTMLElement>('span')]
  const lineMap = new Map<number, string[]>()

  wordSpans.forEach((span) => {
    const top = Math.round(span.getBoundingClientRect().top)
    if (!lineMap.has(top)) lineMap.set(top, [])
    lineMap.get(top)!.push(span.textContent ?? '')
  })

  const lines = [...lineMap.values()]

  if (masked) {
    el.innerHTML = lines
      .map((lineWords) => {
        const text = lineWords.join(' ')
        return `<span style="display:block;overflow:hidden;vertical-align:bottom" aria-hidden="true"><span style="display:block;will-change:transform;transform:translateY(110%)">${text}</span></span>`
      })
      .join('')
    return { spans: [...el.querySelectorAll<HTMLElement>('span > span')], originalText }
  }

  el.innerHTML = lines
    .map((lineWords) => {
      const text = lineWords.join(' ')
      return `<span style="display:block;will-change:transform,opacity;opacity:0" aria-hidden="true">${text}</span>`
    })
    .join('')
  return { spans: [...el.querySelectorAll<HTMLElement>('span')], originalText }
}
