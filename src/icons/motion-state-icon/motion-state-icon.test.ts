import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion, waitForEvent } from '../../test/helpers.js'
import type { MotionStateIcon, StateIconName } from './motion-state-icon.js'
import './motion-state-icon.js'

const NAMES: StateIconName[] = [
  'menu',
  'play',
  'copy',
  'plus',
  'chevron',
  'heart',
  'loading',
  'eye',
]

const part = (el: MotionStateIcon, cls: string) =>
  el.shadowRoot!.querySelector<SVGElement>(`.${cls}`)!
const settle = () => new Promise((resolve) => setTimeout(resolve, 700))

describe('motion-state-icon', () => {
  beforeEach(() => stubReducedMotion(false))

  for (const name of NAMES) {
    it(`renders ${name}`, async () => {
      const el = (await fixture(
        html`<motion-state-icon name=${name}></motion-state-icon>`,
      )) as MotionStateIcon
      expect(el.shadowRoot!.querySelectorAll('svg > *').length).toBeGreaterThan(0)
    })
  }

  it('morphs menu into close', async () => {
    const el = (await fixture(
      html`<motion-state-icon name="menu"></motion-state-icon>`,
    )) as MotionStateIcon
    el.active = true
    await elementUpdated(el)
    await settle()
    expect(getComputedStyle(part(el, 'mid')).opacity).toBe('0')
    expect(part(el, 'top').style.transform).toContain('rotate(45deg)')
  })

  it('fills the heart with the accent color', async () => {
    const el = (await fixture(
      html`<motion-state-icon
        name="heart"
        active
        style="--icon-accent: rgb(0, 0, 255)"
      ></motion-state-icon>`,
    )) as MotionStateIcon
    await settle()
    const heart = getComputedStyle(part(el, 'h'))
    expect(heart.fill).toBe('rgb(0, 0, 255)')
    expect(heart.fillOpacity).toBe('1')
  })

  it('uses a red heart and a green check by default', async () => {
    const heart = (await fixture(
      html`<motion-state-icon name="heart"></motion-state-icon>`,
    )) as MotionStateIcon
    const copy = (await fixture(
      html`<motion-state-icon name="copy"></motion-state-icon>`,
    )) as MotionStateIcon
    expect(getComputedStyle(part(heart, 'h')).fill).toBe('rgb(225, 29, 72)')
    expect(getComputedStyle(part(copy, 'check')).stroke).toBe('rgb(22, 163, 74)')
  })

  it('is decorative without label or toggle', async () => {
    const el = (await fixture(
      html`<motion-state-icon name="plus"></motion-state-icon>`,
    )) as MotionStateIcon
    expect(el.getAttribute('aria-hidden')).toBe('true')
  })

  it('toggle makes a button that switches state and fires motion-change', async () => {
    const el = (await fixture(
      html`<motion-state-icon name="play" toggle label="Play"></motion-state-icon>`,
    )) as MotionStateIcon
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

  it('spins while loading and stops when done', async () => {
    const el = (await fixture(
      html`<motion-state-icon name="loading"></motion-state-icon>`,
    )) as MotionStateIcon
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
      html`<motion-state-icon name="eye"></motion-state-icon>`,
    )) as MotionStateIcon
    el.active = true
    await elementUpdated(el)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(Number(getComputedStyle(part(el, 'slash')).strokeDashoffset.replace('px', ''))).toBe(0)
  })
})
