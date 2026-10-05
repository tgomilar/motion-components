import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion, stubIntersectionObserver } from '../../test/helpers.js'
import type { MotionUnderline } from './motion-underline.js'
import './motion-underline.js'

const progress = (el: HTMLElement) => Number(el.style.getPropertyValue('--mc-_mark-progress'))
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function until(check: () => boolean, timeout = 3000) {
  const start = performance.now()
  while (!check() && performance.now() - start < timeout) await wait(30)
}

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

  it('draws a zigzag of straight segments under one line with shape="zigzag"', async () => {
    const el = await mount('shape="zigzag"', 'no jank')
    await el.finished
    const d = el.shadowRoot!.querySelector('svg path')!.getAttribute('d')!
    const points = d.match(/L/g) ?? []
    expect(d).not.toMatch(/[QT]/)
    expect(points.length % 2).toBe(0)
    const parts = d.trim().split(' ')
    expect(Number(parts[parts.length - 2].slice(1))).toBeCloseTo(el.offsetWidth, 1)
    expect(el.getClientRects()).toHaveLength(1)
  })

  it('cycles the wave on repeat with loop', async () => {
    const el = await mount('loop shape="wave" duration="0.2" hold="0.3" gap="0.2"', 'loops')
    await wait(400)
    const start = progress(el)
    expect(start).toBeGreaterThan(0.9)
    await until(() => progress(el) < 0.05)
    expect(progress(el)).toBeLessThan(0.05)
    await until(() => progress(el) > 0.95)
    expect(progress(el)).toBeGreaterThan(0.95)
    expect(el.playState).toBe('running')
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
