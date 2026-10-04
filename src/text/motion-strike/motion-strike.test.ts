import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion, stubIntersectionObserver } from '../../test/helpers.js'
import type { MotionStrike } from './motion-strike.js'
import './motion-strike.js'

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
    expect(el.style.getPropertyValue('--mc-mark-progress')).toBe('1')
    expect(style.backgroundPositionY).toBe('58%')
    expect(style.backgroundSize).toContain('2px')
    expect(el.textContent).toBe('€49')
  })
})
