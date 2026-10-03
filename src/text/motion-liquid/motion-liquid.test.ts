import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion } from '../../test/helpers.js'
import type { MotionLiquid } from './motion-liquid.js'
import './motion-liquid.js'

const svgOf = (el: MotionLiquid) => el.shadowRoot!.querySelector('svg')!
const textOf = (el: MotionLiquid) => el.shadowRoot!.querySelector('text')!
const animations = (el: MotionLiquid) => [...el.shadowRoot!.querySelectorAll('animate')]
const animationOf = (el: MotionLiquid, attr: string) =>
  el.shadowRoot!.querySelector(`animate[attributeName="${attr}"]`)!

describe('motion-liquid', () => {
  beforeEach(() => {
    stubReducedMotion(false)
  })

  it('renders the text attribute as SVG text labelled for screen readers', async () => {
    const el = (await fixture(html`<motion-liquid text="Flow"></motion-liquid>`)) as MotionLiquid
    expect(textOf(el).textContent).toBe('Flow')
    expect(svgOf(el).getAttribute('role')).toBe('img')
    expect(svgOf(el).getAttribute('aria-label')).toBe('Flow')
  })

  it('takes its text from child text and clears the light DOM', async () => {
    const el = (await fixture(html`<motion-liquid> Liquid </motion-liquid>`)) as MotionLiquid
    expect(el.text).toBe('Liquid')
    expect(el.textContent).toBe('')
    expect(textOf(el).textContent).toBe('Liquid')
    expect(svgOf(el).getAttribute('aria-label')).toBe('Liquid')
  })

  it('applies the distortion filter to the text', async () => {
    const el = (await fixture(html`<motion-liquid text="Flow"></motion-liquid>`)) as MotionLiquid
    expect(textOf(el).getAttribute('filter')).toBe('url(#liquid-filter)')
  })

  it('derives the displacement scale and pulse from intensity', async () => {
    const el = (await fixture(
      html`<motion-liquid text="Flow" intensity="20"></motion-liquid>`,
    )) as MotionLiquid
    const map = el.shadowRoot!.querySelector('feDisplacementMap')!
    expect(map.getAttribute('scale')).toBe('20')
    expect(animationOf(el, 'scale').getAttribute('values')).toBe('6.000; 20.000; 6.000')
  })

  it('times one distortion cycle with the default duration of 4.5 seconds', async () => {
    const el = (await fixture(html`<motion-liquid text="Flow"></motion-liquid>`)) as MotionLiquid
    expect(el.duration).toBe(4.5)
    expect(animationOf(el, 'baseFrequency').getAttribute('dur')).toBe('4.500s')
    expect(animationOf(el, 'scale').getAttribute('dur')).toBe('2.619s')
  })

  it('derives both cycle durations from the duration attribute', async () => {
    const el = (await fixture(
      html`<motion-liquid text="Flow" duration="2"></motion-liquid>`,
    )) as MotionLiquid
    expect(animationOf(el, 'baseFrequency').getAttribute('dur')).toBe('2.000s')
    expect(animationOf(el, 'scale').getAttribute('dur')).toBe('1.164s')

    el.duration = 6
    await elementUpdated(el)
    expect(animationOf(el, 'baseFrequency').getAttribute('dur')).toBe('6.000s')
  })

  it('duration="0" renders the text static and undistorted', async () => {
    const el = (await fixture(
      html`<motion-liquid text="Flow" duration="0"></motion-liquid>`,
    )) as MotionLiquid
    expect(animations(el)).toHaveLength(0)
    expect(textOf(el).hasAttribute('filter')).toBe(false)
  })

  it('pause / play / finish / cancel drive the SVG animation clock', async () => {
    const el = (await fixture(html`<motion-liquid text="Flow"></motion-liquid>`)) as MotionLiquid
    void el.play()
    expect(el.playState).toBe('running')
    el.pause()
    expect(el.playState).toBe('paused')
    expect(svgOf(el).animationsPaused()).toBe(true)
    void el.play()
    expect(el.playState).toBe('running')
    expect(svgOf(el).animationsPaused()).toBe(false)
    el.pause()
    el.finish()
    expect(el.playState).toBe('finished')
    expect(svgOf(el).animationsPaused()).toBe(false)
    void el.play()
    el.pause()
    el.cancel()
    expect(el.playState).toBe('idle')
    expect(svgOf(el).animationsPaused()).toBe(false)
  })

  it('pause-on-hover pauses the distortion while hovered once playing', async () => {
    const el = (await fixture(
      html`<motion-liquid text="Flow" pause-on-hover></motion-liquid>`,
    )) as MotionLiquid
    void el.play()
    el.dispatchEvent(new MouseEvent('mouseenter'))
    expect(el.playState).toBe('paused')
    expect(svgOf(el).animationsPaused()).toBe(true)
    el.dispatchEvent(new MouseEvent('mouseleave'))
    expect(el.playState).toBe('running')
    expect(svgOf(el).animationsPaused()).toBe(false)
  })

  it('pause-on-hover="false" ignores hover', async () => {
    const el = (await fixture(
      html`<motion-liquid text="Flow" pause-on-hover="false"></motion-liquid>`,
    )) as MotionLiquid
    expect(el.pauseOnHover).toBe(false)
    void el.play()
    el.dispatchEvent(new MouseEvent('mouseenter'))
    expect(el.playState).toBe('running')
    expect(svgOf(el).animationsPaused()).toBe(false)
  })

  it('reduced motion renders the text static and undistorted', async () => {
    stubReducedMotion(true)
    const el = (await fixture(html`<motion-liquid text="Flow"></motion-liquid>`)) as MotionLiquid
    expect(animations(el)).toHaveLength(0)
    expect(textOf(el).hasAttribute('filter')).toBe(false)
    expect(svgOf(el).getAttribute('aria-label')).toBe('Flow')
  })

  it('pause-on-hover works without calling play() first', async () => {
    const el = (await fixture(
      html`<motion-liquid text="X" pause-on-hover></motion-liquid>`,
    )) as MotionLiquid
    await elementUpdated(el)
    expect(el.playState).toBe('running')
    el.dispatchEvent(new MouseEvent('mouseenter'))
    expect(el.playState).toBe('paused')
  })
})
