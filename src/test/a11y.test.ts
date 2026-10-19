import { describe, it, expect } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import type { TemplateResult } from 'lit'
import axe from 'axe-core'

import '../components/motion-dialog/motion-dialog.js'
import '../components/motion-slider/motion-slider.js'
import '../components/motion-image-compare/motion-image-compare.js'
import '../components/motion-gallery/motion-gallery.js'
import '../components/motion-flip-card/motion-flip-card.js'
import '../components/motion-theme-toggle/motion-theme-toggle.js'
import '../components/motion-theme-icon/motion-theme-icon.js'
import '../components/motion-progress/motion-progress.js'
import '../components/motion-countdown/motion-countdown.js'
import '../components/motion-spotlight/motion-spotlight.js'

// axe checks a fragment, not a page — skip the rules about page structure.
const PAGE_RULES = [
  'region',
  'landmark-one-main',
  'page-has-heading-one',
  'document-title',
  'html-has-lang',
]

/** Fail with axe's own description of every violation inside `el` (shadow roots included). */
async function expectAccessible(el: Element) {
  const { violations } = await axe.run(el, {
    rules: Object.fromEntries(PAGE_RULES.map((id) => [id, { enabled: false }])),
  })
  const report = violations.map(
    (v) => `${v.id}: ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`,
  )
  expect(report).toEqual([])
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 600))

async function mount(template: TemplateResult) {
  const el = await fixture(template)
  await elementUpdated(el)
  return el
}

const FUTURE = new Date(Date.now() + 86_400_000).toISOString()

describe('accessibility (axe)', () => {
  const cases: [string, () => TemplateResult][] = [
    ['motion-dialog', () => html`<motion-dialog><p>Body</p></motion-dialog>`],
    [
      'motion-slider',
      () =>
        html`<motion-slider>
          <div>Slide 1</div>
          <div>Slide 2</div>
          <div>Slide 3</div>
        </motion-slider>`,
    ],
    [
      'motion-image-compare',
      () =>
        html`<motion-image-compare start="50">
          <img slot="before" src="a.png" alt="Before" />
          <img slot="after" src="b.png" alt="After" />
        </motion-image-compare>`,
    ],
    [
      'motion-gallery',
      () =>
        html`<motion-gallery columns="3">
          <img src="a.png" alt="A" data-caption="First" />
          <img src="b.png" alt="B" data-caption="Second" />
          <img src="c.png" alt="C" />
        </motion-gallery>`,
    ],
    [
      'motion-flip-card',
      () =>
        html`<motion-flip-card trigger="click">
          <div slot="front">Front</div>
          <div slot="back">Back</div>
        </motion-flip-card>`,
    ],
    ['motion-theme-toggle', () => html`<motion-theme-toggle></motion-theme-toggle>`],
    ['motion-theme-icon', () => html`<motion-theme-icon></motion-theme-icon>`],
    ['motion-progress', () => html`<motion-progress></motion-progress>`],
    [
      'motion-countdown',
      () => html`<motion-countdown to=${FUTURE} format="hours minutes seconds"></motion-countdown>`,
    ],
    ['motion-spotlight', () => html`<motion-spotlight><div>content</div></motion-spotlight>`],
  ]

  for (const [name, template] of cases) {
    it(`${name} has no violations`, async () => {
      await expectAccessible(await mount(template()))
    })
  }

  it('motion-dialog has no violations while open', async () => {
    const el = (await mount(html`<motion-dialog><p>Body</p></motion-dialog>`)) as HTMLElement & {
      show(): void
    }
    el.show()
    await settle()
    await expectAccessible(el)
  })

  it('motion-gallery has no violations with the lightbox open', async () => {
    const el = (await mount(
      html`<motion-gallery>
        <img src="a.png" alt="A" data-caption="First" />
        <img src="b.png" alt="B" />
      </motion-gallery>`,
    )) as HTMLElement & { open(index?: number): void }
    el.open(0)
    await settle()
    await expectAccessible(el)
  })

  it('motion-flip-card has no violations once flipped', async () => {
    const el = (await mount(
      html`<motion-flip-card trigger="click">
        <div slot="front">Front</div>
        <div slot="back">Back</div>
      </motion-flip-card>`,
    )) as HTMLElement & { flip(): void }
    el.flip()
    await settle()
    await expectAccessible(el)
  })
})
