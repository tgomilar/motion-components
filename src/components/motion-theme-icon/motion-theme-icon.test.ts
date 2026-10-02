import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion } from '../../test/helpers.js'

const { animateMock } = vi.hoisted(() => ({
  animateMock: vi.fn((..._args: unknown[]) => ({ stop: vi.fn() })),
}))
vi.mock('motion', () => ({ animate: animateMock }))

import type { MotionThemeIcon } from './motion-theme-icon.js'
import './motion-theme-icon.js'

const callFor = (el: MotionThemeIcon, part: string) =>
  animateMock.mock.calls.find(([target]) => target === el.shadowRoot!.querySelector(`.${part}`))

describe('motion-theme-icon', () => {
  beforeEach(() => {
    stubReducedMotion(false)
    animateMock.mockClear()
  })

  it('applies the initial pose instantly', async () => {
    const el = (await fixture(
      html`<motion-theme-icon mode="dark"></motion-theme-icon>`,
    )) as MotionThemeIcon
    await elementUpdated(el)
    const [, keyframes, options] = callFor(el, 'rays')!
    expect(keyframes).toMatchObject({ scale: 0 })
    expect(options).toEqual({ duration: 0 })
  })

  it('morphs with a spring when the mode changes', async () => {
    const el = (await fixture(html`<motion-theme-icon></motion-theme-icon>`)) as MotionThemeIcon
    await elementUpdated(el)
    animateMock.mockClear()
    el.mode = 'dark'
    await elementUpdated(el)
    expect(callFor(el, 'rays')![1]).toMatchObject({ scale: 0, rotate: -90 })
    expect(callFor(el, 'cut')![1]).toMatchObject({ x: 0, y: 0 })
    expect(callFor(el, 'core')![2]).toMatchObject({ type: 'spring', duration: 0.5, bounce: 0.25 })
  })

  it('shows the half disc for system', async () => {
    const el = (await fixture(
      html`<motion-theme-icon mode="system"></motion-theme-icon>`,
    )) as MotionThemeIcon
    await elementUpdated(el)
    expect(callFor(el, 'half')![1]).toMatchObject({ x: 0 })
    expect(callFor(el, 'ring')![1]).toMatchObject({ opacity: 1 })
  })

  it('snaps instantly under reduced motion', async () => {
    stubReducedMotion(true)
    const el = (await fixture(html`<motion-theme-icon></motion-theme-icon>`)) as MotionThemeIcon
    await elementUpdated(el)
    animateMock.mockClear()
    el.mode = 'dark'
    await elementUpdated(el)
    expect(callFor(el, 'core')![2]).toEqual({ duration: 0 })
  })
})
