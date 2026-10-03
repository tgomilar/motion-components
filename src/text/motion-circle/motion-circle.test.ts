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
  }
  return { controls, animateMock: vi.fn((..._args: unknown[]) => controls) }
})
vi.mock('motion', () => ({ animate: animateMock }))

import type { MotionCircle } from './motion-circle.js'
import './motion-circle.js'

const chars = (el: MotionCircle) => [...el.shadowRoot!.querySelectorAll<HTMLElement>('.char')]
const ring = (el: MotionCircle) => el.shadowRoot!.querySelector<HTMLElement>('.ring')!
const lastCall = () => animateMock.mock.calls[animateMock.mock.calls.length - 1]

describe('motion-circle', () => {
  beforeEach(() => {
    stubReducedMotion(false)
    vi.clearAllMocks()
  })

  it('lays out the text attribute one glyph per span', async () => {
    const el = (await fixture(html`<motion-circle text="A B"></motion-circle>`)) as MotionCircle
    expect(chars(el).map((c) => c.textContent)).toEqual(['A', ' ', 'B'])
  })

  it('renders child content in the centre slot', async () => {
    const el = (await fixture(
      html`<motion-circle text="RING"><span id="logo">Logo</span></motion-circle>`,
    )) as MotionCircle
    const slot = el.shadowRoot!.querySelector<HTMLSlotElement>('.center slot')!
    expect(slot.assignedElements()[0]?.id).toBe('logo')
    expect(chars(el)).toHaveLength(4)
  })

  it('sizes the container from radius and spaces glyphs evenly around the circle', async () => {
    const el = (await fixture(
      html`<motion-circle text="ABCD" radius="40"></motion-circle>`,
    )) as MotionCircle
    const container = el.shadowRoot!.querySelector<HTMLElement>('.container')!
    expect(container.style.width).toBe('80px')
    expect(container.style.height).toBe('80px')
    const transforms = chars(el).map((c) => c.style.transform)
    expect(transforms[0]).toContain('rotate(-90deg)')
    expect(transforms[1]).toContain('rotate(0deg)')
    expect(transforms[2]).toContain('rotate(90deg)')
    expect(transforms[3]).toContain('rotate(180deg)')
    expect(transforms[0]).toContain('translateY(-40px)')
  })

  it('upright counter-rotates each glyph', async () => {
    const el = (await fixture(
      html`<motion-circle text="ABCD" upright></motion-circle>`,
    )) as MotionCircle
    expect(chars(el)[2].style.transform).toMatch(/rotate\(90deg\).*rotate\(-90deg\)$/)
  })

  it('rotates once every 8 seconds by default', async () => {
    const el = (await fixture(html`<motion-circle text="ABCD"></motion-circle>`)) as MotionCircle
    expect(animateMock).toHaveBeenCalledOnce()
    const [target, keyframes, options] = lastCall()
    expect(target).toBe(ring(el))
    expect(keyframes).toEqual({ rotate: [0, 360] })
    expect(options).toMatchObject({ duration: 8, repeat: Infinity, ease: 'linear' })
    expect(el.playState).toBe('running')
  })

  it('hands duration as seconds per full rotation to Motion', async () => {
    await fixture(html`<motion-circle text="ABCD" duration="12"></motion-circle>`)
    expect(lastCall()[2]).toMatchObject({ duration: 12 })
  })

  it('direction="ccw" rotates the other way', async () => {
    await fixture(html`<motion-circle text="ABCD" direction="ccw"></motion-circle>`)
    expect(lastCall()[1]).toEqual({ rotate: [0, -360] })
  })

  it('restarts with the new timing when duration changes', async () => {
    const el = (await fixture(html`<motion-circle text="ABCD"></motion-circle>`)) as MotionCircle
    el.duration = 3
    await elementUpdated(el)
    expect(controls.cancel).toHaveBeenCalled()
    expect(animateMock).toHaveBeenCalledTimes(2)
    expect(lastCall()[2]).toMatchObject({ duration: 3 })
    expect(el.playState).toBe('running')
  })

  it('pause-on-hover pauses on enter and resumes on leave', async () => {
    const el = (await fixture(
      html`<motion-circle text="ABCD" pause-on-hover></motion-circle>`,
    )) as MotionCircle
    el.dispatchEvent(new MouseEvent('mouseenter'))
    expect(controls.pause).toHaveBeenCalledOnce()
    expect(el.playState).toBe('paused')
    el.dispatchEvent(new MouseEvent('mouseleave'))
    expect(controls.play).toHaveBeenCalledOnce()
    expect(el.playState).toBe('running')
  })

  it('pause-on-hover="false" keeps rotating on hover', async () => {
    const el = (await fixture(
      html`<motion-circle text="ABCD" pause-on-hover="false"></motion-circle>`,
    )) as MotionCircle
    expect(el.pauseOnHover).toBe(false)
    el.dispatchEvent(new MouseEvent('mouseenter'))
    expect(controls.pause).not.toHaveBeenCalled()
    expect(el.playState).toBe('running')
  })

  it('pause / play / finish / cancel drive the Motion controls', async () => {
    const el = (await fixture(html`<motion-circle text="ABCD"></motion-circle>`)) as MotionCircle
    el.pause()
    expect(controls.pause).toHaveBeenCalled()
    expect(el.playState).toBe('paused')
    void el.play()
    expect(controls.play).toHaveBeenCalled()
    expect(el.playState).toBe('running')
    el.finish()
    expect(controls.complete).toHaveBeenCalledOnce()
    expect(el.playState).toBe('finished')
    void el.play()
    el.cancel()
    expect(controls.cancel).toHaveBeenCalledOnce()
    expect(el.playState).toBe('idle')
    expect(ring(el).style.transform).toBe('')
  })

  it('reduced motion renders statically without animating', async () => {
    stubReducedMotion(true)
    const el = (await fixture(html`<motion-circle text="ABCD"></motion-circle>`)) as MotionCircle
    expect(animateMock).not.toHaveBeenCalled()
    expect(el.playState).toBe('finished')
    expect(chars(el)).toHaveLength(4)
  })

  it('exposes the full text to screen readers once', async () => {
    const el = (await fixture(html`<motion-circle text="Read me"></motion-circle>`)) as HTMLElement
    await elementUpdated(el)
    expect(el.shadowRoot!.querySelector('.sr-only')!.textContent).toBe('Read me')
    expect(el.shadowRoot!.querySelector('.char')!.closest('[aria-hidden="true"]')).not.toBeNull()
  })
})
