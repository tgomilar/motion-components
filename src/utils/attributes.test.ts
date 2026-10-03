import { describe, it, expect } from 'vitest'
import { fixture, html } from '@open-wc/testing-helpers'
import { readFlag } from './attributes.js'
import '../text/motion-counter/motion-counter.js'
import '../scroll/motion-scene/motion-scene.js'
import type { MotionCounter } from '../text/motion-counter/motion-counter.js'
import type { MotionScene } from '../scroll/motion-scene/motion-scene.js'

describe('flag attributes', () => {
  it('turns a default-true flag off with ="false"', async () => {
    const counter = (await fixture(
      html`<motion-counter once="false"></motion-counter>`,
    )) as MotionCounter
    const scene = (await fixture(html`<motion-scene pin="false"></motion-scene>`)) as MotionScene
    expect(counter.once).toBe(false)
    expect(scene.pin).toBe(false)
  })

  it('treats a present attribute without "false" as true', async () => {
    const counter = (await fixture(
      html`<motion-counter once=""></motion-counter>`,
    )) as MotionCounter
    expect(counter.once).toBe(true)
  })

  it('readFlag falls back when the attribute is missing', () => {
    const el = document.createElement('div')
    expect(readFlag(el, 'wave', true)).toBe(true)
    el.setAttribute('wave', 'false')
    expect(readFlag(el, 'wave', true)).toBe(false)
    el.setAttribute('wave', '')
    expect(readFlag(el, 'wave', false)).toBe(true)
  })
})
