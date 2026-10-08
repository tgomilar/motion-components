import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion } from '../../test/helpers.js'

// Rotation runs through Motion; the contract is the keyframes and timing
// handed to `animate`, so we mock it rather than assert frames.
const { animateMock, controls } = vi.hoisted(() => {
  const controls = {
    pause: vi.fn(),
    play: vi.fn(),
    complete: vi.fn(),
    cancel: vi.fn(),
    stop: vi.fn(),
    then: vi.fn(),
  }
  return { controls, animateMock: vi.fn((..._args: unknown[]) => controls) }
})
vi.mock('motion', () => ({ animate: animateMock }))

import type { MotionArc } from './motion-arc.js'
import './motion-arc.js'

const chars = (el: MotionArc) => [...el.shadowRoot!.querySelectorAll<HTMLElement>('.char')]
const ring = (el: MotionArc) => el.shadowRoot!.querySelector<HTMLElement>('.ring')!
const lastCall = () => animateMock.mock.calls[animateMock.mock.calls.length - 1]

describe('motion-arc', () => {
  beforeEach(() => {
    stubReducedMotion(false)
    vi.clearAllMocks()
  })

  it('lays out the text attribute one glyph per span', async () => {
    const el = (await fixture(html`<motion-arc text="A B"></motion-arc>`)) as MotionArc
    expect(chars(el).map((c) => c.textContent)).toEqual(['A', ' ', 'B'])
    expect(el.shadowRoot!.textContent).toContain('A')
  })

  it('renders child content in the centre slot, not along the arc', async () => {
    const el = (await fixture(
      html`<motion-arc text="ARC"><span id="logo">Logo</span></motion-arc>`,
    )) as MotionArc
    const slot = el.shadowRoot!.querySelector<HTMLSlotElement>('.center slot')!
    expect(slot.assignedElements()[0]?.id).toBe('logo')
    expect(chars(el)).toHaveLength(3)
  })

  it('sizes the container from radius and spreads glyphs over the arc', async () => {
    const el = (await fixture(
      html`<motion-arc text="ABC" radius="50" arc="180"></motion-arc>`,
    )) as MotionArc
    const container = el.shadowRoot!.querySelector<HTMLElement>('.container')!
    expect(container.style.width).toBe('100px')
    expect(container.style.height).toBe('100px')
    const transforms = chars(el).map((c) => c.style.transform)
    expect(transforms[0]).toContain('rotate(-90deg)')
    expect(transforms[1]).toContain('rotate(0deg)')
    expect(transforms[2]).toContain('rotate(90deg)')
    expect(transforms[0]).toContain('translateY(-50px)')
  })

  it('align="bottom" centres the arc at the bottom, reading left to right', async () => {
    const el = (await fixture(
      html`<motion-arc text="ABC" radius="50" arc="90" align="bottom"></motion-arc>`,
    )) as MotionArc
    const transforms = chars(el).map((c) => c.style.transform)
    expect(transforms[0]).toContain('rotate(45deg)')
    expect(transforms[1]).toContain('rotate(0deg)')
    expect(transforms[2]).toContain('rotate(-45deg)')
    expect(transforms[0]).toContain('translateY(50px)')
  })

  it('places glyphs where align says, measured on screen', async () => {
    const top = (await fixture(
      html`<motion-arc text="ABCDE" radius="80" arc="120"></motion-arc>`,
    )) as MotionArc
    const bottom = (await fixture(
      html`<motion-arc text="ABCDE" radius="80" arc="120" align="bottom"></motion-arc>`,
    )) as MotionArc
    const middle = (el: MotionArc) => {
      const box = el.shadowRoot!.querySelector('.container')!.getBoundingClientRect()
      const c = chars(el)[2].getBoundingClientRect()
      return {
        dx: c.x + c.width / 2 - (box.x + box.width / 2),
        dy: c.y + c.height / 2 - (box.y + box.height / 2),
      }
    }
    const firstX = (el: MotionArc) => chars(el)[0].getBoundingClientRect().x
    const lastX = (el: MotionArc) => chars(el)[4].getBoundingClientRect().x
    expect(Math.abs(middle(top).dx)).toBeLessThan(2)
    expect(middle(top).dy).toBeLessThan(-70)
    expect(Math.abs(middle(bottom).dx)).toBeLessThan(2)
    expect(middle(bottom).dy).toBeGreaterThan(70)
    expect(firstX(top)).toBeLessThan(lastX(top))
    expect(firstX(bottom)).toBeLessThan(lastX(bottom))
  })

  it('places a single glyph at the arc centre', async () => {
    const el = (await fixture(html`<motion-arc text="A"></motion-arc>`)) as MotionArc
    expect(chars(el)[0].style.transform).toContain('rotate(0deg)')
  })

  it('upright counter-rotates each glyph', async () => {
    const el = (await fixture(
      html`<motion-arc text="AB" arc="90" upright></motion-arc>`,
    )) as MotionArc
    expect(chars(el)[0].style.transform).toMatch(/rotate\(-45deg\).*rotate\(45deg\)$/)
  })

  it('does not rotate by default (duration 0)', async () => {
    const el = (await fixture(html`<motion-arc text="ABC"></motion-arc>`)) as MotionArc
    expect(el.duration).toBe(0)
    expect(animateMock).not.toHaveBeenCalled()
  })

  it('hands duration as seconds per full rotation to Motion', async () => {
    const el = (await fixture(
      html`<motion-arc text="ABC" duration="12"></motion-arc>`,
    )) as MotionArc
    expect(animateMock).toHaveBeenCalledOnce()
    const [target, keyframes, options] = lastCall()
    expect(target).toBe(ring(el))
    expect(keyframes).toEqual({ rotate: [0, 360] })
    expect(options).toMatchObject({ duration: 12, repeat: Infinity, ease: 'linear' })
    expect(el.playState).toBe('running')
  })

  it('direction="ccw" rotates the other way', async () => {
    await fixture(html`<motion-arc text="ABC" duration="6" direction="ccw"></motion-arc>`)
    expect(lastCall()[1]).toEqual({ rotate: [0, -360] })
  })

  it('restarts with the new timing when duration changes', async () => {
    const el = (await fixture(html`<motion-arc text="ABC" duration="6"></motion-arc>`)) as MotionArc
    el.duration = 3
    await elementUpdated(el)
    expect(controls.cancel).toHaveBeenCalled()
    expect(lastCall()[2]).toMatchObject({ duration: 3 })
    expect(el.playState).toBe('running')
  })

  it('pause-on-hover pauses on enter and resumes on leave', async () => {
    const el = (await fixture(
      html`<motion-arc text="ABC" duration="6" pause-on-hover></motion-arc>`,
    )) as MotionArc
    el.dispatchEvent(new MouseEvent('mouseenter'))
    expect(controls.pause).toHaveBeenCalledOnce()
    expect(el.playState).toBe('paused')
    el.dispatchEvent(new MouseEvent('mouseleave'))
    expect(controls.play).toHaveBeenCalledOnce()
    expect(el.playState).toBe('running')
  })

  it('pause-on-hover="false" keeps rotating on hover', async () => {
    const el = (await fixture(
      html`<motion-arc text="ABC" duration="6" pause-on-hover="false"></motion-arc>`,
    )) as MotionArc
    expect(el.pauseOnHover).toBe(false)
    el.dispatchEvent(new MouseEvent('mouseenter'))
    expect(controls.pause).not.toHaveBeenCalled()
    expect(el.playState).toBe('running')
  })

  it('pause / play / finish / cancel drive the Motion controls', async () => {
    const el = (await fixture(html`<motion-arc text="ABC" duration="6"></motion-arc>`)) as MotionArc
    el.pause()
    expect(controls.pause).toHaveBeenCalled()
    expect(el.playState).toBe('paused')
    void el.play()
    expect(controls.play).toHaveBeenCalled()
    expect(el.playState).toBe('running')
    el.finish()
    expect(controls.complete).toHaveBeenCalled()
    expect(el.playState).toBe('finished')
    void el.play()
    el.cancel()
    expect(controls.cancel).toHaveBeenCalled()
    expect(el.playState).toBe('idle')
    expect(ring(el).style.rotate).toBe('')
  })

  it('reduced motion renders statically without animating', async () => {
    stubReducedMotion(true)
    const el = (await fixture(html`<motion-arc text="ABC" duration="6"></motion-arc>`)) as MotionArc
    expect(animateMock).not.toHaveBeenCalled()
    expect(el.playState).toBe('finished')
    expect(chars(el)).toHaveLength(3)
  })

  it('exposes the full text to screen readers once', async () => {
    const el = (await fixture(html`<motion-arc text="Read me"></motion-arc>`)) as HTMLElement
    await elementUpdated(el)
    expect(el.shadowRoot!.querySelector('.sr-only')!.textContent).toBe('Read me')
    expect(el.shadowRoot!.querySelector('.char')!.closest('[aria-hidden="true"]')).not.toBeNull()
  })
})
