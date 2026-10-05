import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion, stubIntersectionObserver } from '../../test/helpers.js'
import type { MotionStrike } from './motion-strike.js'
import './motion-strike.js'

const progress = (el: HTMLElement) => Number(el.style.getPropertyValue('--mc-_mark-progress'))
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function until(check: () => boolean, timeout = 3000) {
  const start = performance.now()
  while (!check() && performance.now() - start < timeout) await wait(30)
}

describe('motion-strike', () => {
  beforeEach(() => {
    stubReducedMotion(false)
    stubIntersectionObserver()
  })

  it('draws a band through the middle of the text, inside a del element', async () => {
    const host = document.createElement('div')
    host.innerHTML =
      '<p><del><motion-strike trigger="mount" duration="0.2">€49</motion-strike></del> <ins>€29</ins></p>'
    const p = (await fixture(host.firstElementChild!)) as HTMLElement
    const el = p.querySelector('motion-strike') as MotionStrike
    await elementUpdated(el)
    await el.finished
    const style = getComputedStyle(el)
    expect(el.style.getPropertyValue('--mc-_mark-progress')).toBe('1')
    expect(style.backgroundPositionY).toBe('58%')
    expect(style.backgroundSize).toContain('2px')
    expect(el.textContent).toBe('€49')
  })

  it('draws and undraws on repeat with loop', async () => {
    const host = document.createElement('div')
    host.innerHTML =
      '<p><motion-strike trigger="mount" loop duration="0.2" hold="0.3" gap="0.2">€49</motion-strike></p>'
    const p = (await fixture(host.firstElementChild!)) as HTMLElement
    const el = p.querySelector('motion-strike') as MotionStrike
    await elementUpdated(el)
    await wait(350)
    expect(progress(el)).toBeGreaterThan(0.95)
    await until(() => progress(el) < 0.05)
    expect(progress(el)).toBeLessThan(0.05)
    await until(() => progress(el) > 0.95)
    expect(el.playState).toBe('running')
  })
})
