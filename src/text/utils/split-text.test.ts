import { describe, it, expect } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { escapeHtml } from './split-text.js'
import { stubReducedMotion } from '../../test/helpers.js'
import '../motion-split/motion-split.js'
import '../motion-headline/motion-headline.js'
import '../motion-glitch/motion-glitch.js'

const payload = '<img src=x onerror="window.__xss = true">'

describe('text splitting is safe from HTML injection', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    )
  })

  for (const tag of ['motion-split', 'motion-headline', 'motion-glitch']) {
    it(`${tag} renders markup-like text as text`, async () => {
      const host = document.createElement('div')
      host.innerHTML = `<${tag}>${escapeHtml(payload)}</${tag}>`
      const el = (await fixture(html`${host}`)).firstElementChild as HTMLElement
      await elementUpdated(el)
      expect(el.querySelector('img')).toBeNull()
      expect(el.textContent).toContain('<img')
    })
  }
})

describe('reduced motion shows split text at once', () => {
  for (const tag of ['motion-split', 'motion-headline']) {
    it(tag, async () => {
      stubReducedMotion(true)
      const host = document.createElement('div')
      host.innerHTML = `<${tag}>Hello there world</${tag}>`
      const el = (await fixture(html`${host}`)).firstElementChild as HTMLElement
      await elementUpdated(el)
      const spans = [...el.querySelectorAll<HTMLElement>('span')].filter(
        (s) => !s.querySelector('span'),
      )
      expect(spans.length).toBeGreaterThan(0)
      for (const s of spans) {
        expect(s.style.opacity === '' || s.style.opacity === '1').toBe(true)
        expect(s.style.transform).toBe('')
      }
    })
  }
})
