import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion, stubIntersectionObserver } from '../../test/helpers.js'
import type { MotionUnderline } from './motion-underline.js'
import './motion-underline.js'

async function mount(attrs = '', text = 'feel right') {
  const host = document.createElement('div')
  host.innerHTML = `<p style="font-size: 20px">Interactions that <motion-underline trigger="mount" duration="0.2" ${attrs}>${text}</motion-underline>.</p>`
  const p = (await fixture(host.firstElementChild!)) as HTMLElement
  const el = p.querySelector('motion-underline') as MotionUnderline
  await elementUpdated(el)
  return el
}

describe('motion-underline', () => {
  beforeEach(() => {
    stubReducedMotion(false)
    stubIntersectionObserver()
  })

  it('draws a straight band at the bottom of each line by default', async () => {
    const el = await mount()
    await el.finished
    const style = getComputedStyle(el)
    expect(el.shape).toBe('line')
    expect(style.display).toBe('inline')
    expect(style.backgroundPositionY).toBe('100%')
    expect(el.shadowRoot!.querySelector('svg')).toBeNull()
  })

  it('uses --mc-mark-thickness and --mc-mark-color', async () => {
    const el = await mount('style="--mc-mark-thickness: 5px; --mc-mark-color: rgb(255, 0, 0)"')
    await el.finished
    const style = getComputedStyle(el)
    expect(style.backgroundSize).toContain('5px')
    expect(style.backgroundImage).toContain('rgb(255, 0, 0)')
  })

  it('draws dashes or dots that follow wrapping text with shape="dashed" or "dotted"', async () => {
    for (const shape of ['dashed', 'dotted']) {
      const el = await mount(`shape="${shape}"`)
      await el.finished
      const style = getComputedStyle(el)
      expect(style.display).toBe('inline')
      expect(style.backgroundImage).toContain('repeating-linear-gradient')
      expect(el.shadowRoot!.querySelector('svg')).toBeNull()
    }
  })

  it('draws a wavy path under one line with shape="wave"', async () => {
    const el = await mount('shape="wave"', 'easing curves')
    await el.finished
    const path = el.shadowRoot!.querySelector('svg path')!
    expect(path.closest('svg')!.getAttribute('aria-hidden')).toBe('true')
    expect(path.getAttribute('pathLength')).toBe('1')
    expect(path.getAttribute('d')).toMatch(/^M0 [\d.]+ Q.* T/)
    expect(el.getClientRects()).toHaveLength(1)
    expect(Number(path.closest('svg')!.getAttribute('width'))).toBe(el.offsetWidth)
  })

  it('waits until it is rendered before drawing the wave', async () => {
    const outer = document.createElement('div')
    outer.attachShadow({ mode: 'open' })
    outer.innerHTML = '<motion-underline shape="wave">not yet slotted</motion-underline>'
    document.body.append(outer)
    const el = outer.firstElementChild as MotionUnderline
    await elementUpdated(el)
    const path = el.shadowRoot!.querySelector('svg path')!
    expect(path.getAttribute('d') ?? '').not.toContain('NaN')
    outer.shadowRoot!.innerHTML = '<slot></slot>'
    await new Promise(requestAnimationFrame)
    await new Promise(requestAnimationFrame)
    expect(path.getAttribute('d')).toMatch(/^M0 [\d.]+ Q.* T/)
    outer.remove()
  })
})
