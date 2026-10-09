import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion, waitForEvent } from '../../test/helpers.js'
import type { MotionIconState, IconStateName } from './motion-icon-state.js'
import './motion-icon-state.js'
import { pauseAll, resumeAll } from '../../utils/registry.js'

const NAMES: IconStateName[] = [
  'menu',
  'play',
  'copy',
  'plus',
  'chevron',
  'heart',
  'loading',
  'eye',
]

const part = (el: MotionIconState, cls: string) =>
  el.shadowRoot!.querySelector<SVGElement>(`.${cls}`)!
const settle = () => new Promise((resolve) => setTimeout(resolve, 700))

describe('motion-icon-state', () => {
  beforeEach(() => stubReducedMotion(false))

  for (const name of NAMES) {
    it(`renders ${name}`, async () => {
      const el = (await fixture(
        html`<motion-icon-state name=${name}></motion-icon-state>`,
      )) as MotionIconState
      expect(el.shadowRoot!.querySelectorAll('svg > *').length).toBeGreaterThan(0)
    })
  }

  it('morphs menu into close', async () => {
    const el = (await fixture(
      html`<motion-icon-state name="menu"></motion-icon-state>`,
    )) as MotionIconState
    el.active = true
    await elementUpdated(el)
    await settle()
    expect(getComputedStyle(part(el, 'mid')).opacity).toBe('0')
    expect(part(el, 'top').style.transform).toContain('rotate(45deg)')
  })

  it('fills the heart with the second-state color', async () => {
    const el = (await fixture(
      html`<motion-icon-state
        name="heart"
        active
        style="--mc-icon-color-active: rgb(0, 0, 255)"
      ></motion-icon-state>`,
    )) as MotionIconState
    await settle()
    const heart = getComputedStyle(part(el, 'h'))
    expect(heart.fill).toBe('rgb(0, 0, 255)')
    expect(heart.fillOpacity).toBe('1')
  })

  it('colors the second state with the text color by default', async () => {
    const heart = (await fixture(
      html`<motion-icon-state name="heart" style="color: rgb(10, 20, 30)"></motion-icon-state>`,
    )) as MotionIconState
    const copy = (await fixture(
      html`<motion-icon-state name="copy" style="color: rgb(10, 20, 30)"></motion-icon-state>`,
    )) as MotionIconState
    expect(getComputedStyle(part(heart, 'h')).fill).toBe('rgb(10, 20, 30)')
    expect(getComputedStyle(part(copy, 'check')).stroke).toBe('rgb(10, 20, 30)')
  })

  it('is decorative without label or toggle', async () => {
    const el = (await fixture(
      html`<motion-icon-state name="plus"></motion-icon-state>`,
    )) as MotionIconState
    expect(el.getAttribute('aria-hidden')).toBe('true')
  })

  it('toggle makes a button that switches state and fires motion-change', async () => {
    const el = (await fixture(
      html`<motion-icon-state name="play" toggle label="Play"></motion-icon-state>`,
    )) as MotionIconState
    expect(el.getAttribute('role')).toBe('button')
    expect(el.getAttribute('aria-pressed')).toBe('false')
    expect(el.tabIndex).toBe(0)

    const changed = waitForEvent(el, 'motion-change')
    el.click()
    const e = (await changed) as CustomEvent
    expect(e.detail).toEqual({ active: true })
    await elementUpdated(el)
    expect(el.getAttribute('aria-pressed')).toBe('true')

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(el.active).toBe(false)
  })

  it('warns once when toggle has no label', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = await fixture<MotionIconState>(
      html`<motion-icon-state name="menu" toggle></motion-icon-state>`,
    )
    el.active = true
    await elementUpdated(el)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(el.getAttribute('aria-label')).toBe('menu')
    warn.mockClear()
    await fixture(html`<motion-icon-state name="menu" toggle label="Menu"></motion-icon-state>`)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('spins while loading and stops when done', async () => {
    const el = (await fixture(
      html`<motion-icon-state name="loading"></motion-icon-state>`,
    )) as MotionIconState
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(part(el, 'arc').style.transform).toContain('rotate')
    el.active = true
    await elementUpdated(el)
    await settle()
    expect(getComputedStyle(part(el, 'arc')).opacity).toBe('0')
  })

  it('switches instantly under reduced motion', async () => {
    stubReducedMotion(true)
    const el = (await fixture(
      html`<motion-icon-state name="eye"></motion-icon-state>`,
    )) as MotionIconState
    el.active = true
    await elementUpdated(el)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(Number(getComputedStyle(part(el, 'slash')).strokeDashoffset.replace('px', ''))).toBe(0)
  })

  it('keeps the loading spinner turning after it is removed and added back', async () => {
    const el = (await fixture(
      html`<motion-icon-state name="loading"></motion-icon-state>`,
    )) as MotionIconState
    const spinning = () => (el as unknown as { spin: unknown }).spin !== null
    expect(spinning()).toBe(true)
    const parent = el.parentElement!
    el.remove()
    expect(spinning()).toBe(false)
    parent.append(el)
    expect(spinning()).toBe(true)
  })

  it('flip() switches the state and fires motion-change', async () => {
    const el = (await fixture(
      html`<motion-icon-state name="heart"></motion-icon-state>`,
    )) as MotionIconState
    const details: boolean[] = []
    el.addEventListener('motion-change', (e) =>
      details.push((e as CustomEvent<{ active: boolean }>).detail.active),
    )
    el.flip()
    expect(el.active).toBe(true)
    el.flip()
    expect(details).toEqual([true, false])
  })

  it('pauseAll() holds the loading spinner and resumeAll() releases it', async () => {
    const el = (await fixture(
      html`<motion-icon-state name="loading"></motion-icon-state>`,
    )) as MotionIconState
    await elementUpdated(el)
    const ring = el.shadowRoot!.querySelector('svg') as SVGElement
    const angle = () => {
      const part = [...el.shadowRoot!.querySelectorAll<SVGElement>('svg *')].find((n) =>
        n.style.transform.includes('rotate'),
      )
      return part?.style.transform ?? ''
    }
    expect(ring).not.toBeNull()
    await new Promise((resolve) => setTimeout(resolve, 100))
    pauseAll()
    await new Promise((resolve) => setTimeout(resolve, 50))
    const held = angle()
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(held).not.toBe('')
    expect(angle()).toBe(held)
    resumeAll()
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(angle()).not.toBe(held)
  })

  it('keeps the spinner held by pauseAll() when the icon moves', async () => {
    const el = (await fixture(
      html`<motion-icon-state name="loading"></motion-icon-state>`,
    )) as MotionIconState
    await elementUpdated(el)
    const angle = () =>
      [...el.shadowRoot!.querySelectorAll<SVGElement>('svg *')].find((n) =>
        n.style.transform.includes('rotate'),
      )?.style.transform ?? ''
    await new Promise((resolve) => setTimeout(resolve, 80))
    pauseAll()
    const parent = el.parentElement!
    el.remove()
    parent.append(el)
    await new Promise((resolve) => setTimeout(resolve, 80))
    const held = angle()
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(angle()).toBe(held)
    resumeAll()
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(angle()).not.toBe(held)
  })

  it('still works under the old name motion-state-icon, with a one-time warning', async () => {
    await import('../motion-state-icon/motion-state-icon.js')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = (await fixture(
      html`<motion-state-icon name="heart" toggle label="Like"></motion-state-icon>`,
    )) as MotionIconState
    await fixture(html`<motion-state-icon name="menu"></motion-state-icon>`)
    expect(el).toBeInstanceOf(customElements.get('motion-icon-state')!)
    el.click()
    expect(el.active).toBe(true)
    expect(warn.mock.calls.filter(([m]) => String(m).includes('motion-icon-state'))).toHaveLength(1)
    warn.mockRestore()
  })

  it('leaves no dot where an undrawn line starts', async () => {
    const el = (await fixture(
      html`<motion-icon-state name="loading"></motion-icon-state>`,
    )) as MotionIconState
    await elementUpdated(el)
    for (const name of ['ring', 'check']) {
      const style = getComputedStyle(part(el, name))
      expect(parseFloat(style.strokeDashoffset)).toBeGreaterThan(1)
      expect(style.strokeDasharray.replace(/px/g, '')).toBe('1, 2')
    }
  })

  it('colors any icon in its second state with --mc-icon-color-active', async () => {
    const el = (await fixture(
      html`<motion-icon-state
        name="menu"
        style="color: rgb(10, 20, 30); --mc-icon-color-active: rgb(200, 100, 0)"
      ></motion-icon-state>`,
    )) as MotionIconState
    const svg = el.shadowRoot!.querySelector('svg')!
    expect(getComputedStyle(svg).stroke).toBe('rgb(10, 20, 30)')
    el.active = true
    await elementUpdated(el)
    expect(getComputedStyle(svg).stroke).toBe('rgb(200, 100, 0)')
  })
})
