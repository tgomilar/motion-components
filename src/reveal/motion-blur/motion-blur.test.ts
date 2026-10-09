import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion, waitForEvent } from '../../test/helpers.js'

// Blur is scroll-driven; real scroll progress is not deterministic here, so we
// mock `scroll`, capture the progress callback, and drive it by hand.
const { scrollMock, cleanups } = vi.hoisted(() => {
  const cleanups: ReturnType<typeof vi.fn>[] = []
  return {
    cleanups,
    scrollMock: vi.fn((..._args: unknown[]) => {
      const cleanup = vi.fn()
      cleanups.push(cleanup)
      return cleanup
    }),
  }
})
vi.mock('motion', () => ({ scroll: scrollMock }))

import type { MotionBlur } from './motion-blur.js'
import './motion-blur.js'

type Progress = (progress: number) => void
const lastCall = () => scrollMock.mock.calls[scrollMock.mock.calls.length - 1]
const progress = (p: number) => (lastCall()[0] as Progress)(p)
const options = () => lastCall()[1] as { target: unknown; offset: unknown }

describe('motion-blur', () => {
  beforeEach(() => {
    stubReducedMotion(false)
    scrollMock.mockClear()
    cleanups.length = 0
  })

  async function mount(direction = 'in', once = 'true') {
    return (await fixture(
      html`<motion-blur intensity="20" y="10" direction=${direction} once=${once}>
        <img alt="" />
      </motion-blur>`,
    )) as MotionBlur
  }

  it('renders a slot and exposes prop defaults', async () => {
    const el = (await fixture(html`<motion-blur><p>content</p></motion-blur>`)) as MotionBlur
    expect(el.shadowRoot!.querySelector('slot')).not.toBeNull()
    expect(el.intensity).toBe(10)
    expect(el.y).toBe(12)
    expect(el.once).toBe(true)
    expect(el.direction).toBe('in')
    expect(el.getAttribute('direction')).toBe('in')
  })

  it('reads attributes into properties', async () => {
    const el = await mount('both', 'false')
    expect(el.intensity).toBe(20)
    expect(el.y).toBe(10)
    expect(el.direction).toBe('both')
    expect(el.once).toBe(false)
  })

  it('direction="in" starts hidden and binds scroll from entry to center', async () => {
    const el = await mount()
    expect(el.playState).toBe('running')
    expect(scrollMock).toHaveBeenCalledOnce()
    expect(options().target).toBe(el)
    expect(options().offset).toEqual(['start end', 'center center'])
    expect(el.style.opacity).toBe('0')
  })

  it('direction="in" maps progress to opacity, blur and translation', async () => {
    const el = await mount()
    progress(0.5)
    expect(el.style.opacity).toBe('0.5')
    expect(el.style.filter).toBe('blur(10px)')
    expect(el.style.transform).toBe('translateY(5px)')

    progress(-1)
    expect(el.style.opacity).toBe('0')
    expect(el.style.filter).toBe('blur(20px)')
  })

  it('with `once`, latches focused at full progress and unbinds', async () => {
    const el = await mount()
    progress(1)
    expect(el.style.opacity).toBe('1')
    expect(el.style.filter).toBe('')
    expect(el.style.transform).toBe('')
    expect(cleanups[0]).toHaveBeenCalled()

    progress(0.2)
    expect(el.style.opacity).toBe('1')
  })

  it('once="false" keeps following scroll after full progress', async () => {
    const el = await mount('in', 'false')
    progress(1)
    expect(cleanups[0]).not.toHaveBeenCalled()
    progress(0.25)
    expect(el.style.opacity).toBe('0.25')
    expect(el.style.filter).toBe('blur(15px)')
  })

  it('direction="out" stays visible and blurs from center to exit', async () => {
    const el = await mount('out')
    expect(el.style.opacity).toBe('')
    expect(options().offset).toEqual(['center center', 'end start'])
    progress(0.5)
    expect(el.style.opacity).toBe('0.5')
    expect(el.style.filter).toBe('blur(10px)')
    expect(el.style.transform).toBe('translateY(-5px)')
  })

  it('direction="both" focuses at the center of the full range', async () => {
    const el = await mount('both')
    expect(options().offset).toEqual(['start end', 'end start'])
    progress(0.5)
    expect(el.style.opacity).toBe('1')
    expect(el.style.filter).toBe('blur(0px)')
    expect(el.style.transform).toBe('translateY(0px)')

    progress(0.25)
    expect(el.style.opacity).toBe('0.5')
    expect(el.style.filter).toBe('blur(10px)')
    expect(el.style.transform).toBe('translateY(5px)')
  })

  it('pause() unbinds scroll and play() rebinds it', async () => {
    const el = await mount()
    el.pause()
    expect(el.playState).toBe('paused')
    expect(cleanups[0]).toHaveBeenCalled()

    void el.play()
    expect(el.playState).toBe('running')
    expect(scrollMock).toHaveBeenCalledTimes(2)
  })

  it('finish() unbinds and applies the focused state for direction="in"', async () => {
    const el = await mount()
    progress(0.3)
    const finished = waitForEvent(el, 'motion-finish')
    el.finish()
    await finished
    expect(el.playState).toBe('finished')
    expect(cleanups[0]).toHaveBeenCalled()
    expect(el.style.opacity).toBe('1')
    expect(el.style.filter).toBe('')
    expect(el.style.transform).toBe('')
  })

  it('finish() applies the blurred exit state for direction="out"', async () => {
    const el = await mount('out')
    el.finish()
    expect(el.style.opacity).toBe('0')
    expect(el.style.filter).toBe('blur(20px)')
    expect(el.style.transform).toBe('translateY(-10px)')
  })

  it('cancel() unbinds, resets to hidden and returns to idle', async () => {
    const el = await mount()
    progress(0.5)
    const cancelled = waitForEvent(el, 'motion-cancel')
    el.cancel()
    await cancelled
    expect(el.playState).toBe('idle')
    expect(cleanups[0]).toHaveBeenCalled()
    expect(el.style.opacity).toBe('0')
    expect(el.style.filter).toBe('')
    expect(el.style.transform).toBe('')
  })

  it('replay() clears the latch and rebinds scroll', async () => {
    const el = await mount()
    progress(1)
    el.replay()
    expect(el.playState).toBe('running')
    expect(scrollMock).toHaveBeenCalledTimes(2)
    progress(0.5)
    expect(el.style.opacity).toBe('0.5')
  })

  it('under reduced motion, shows content immediately and never binds scroll', async () => {
    stubReducedMotion(true)
    const el = await mount()
    await elementUpdated(el)
    expect(el.style.opacity).toBe('1')
    expect(el.style.filter).toBe('')
    expect(scrollMock).not.toHaveBeenCalled()
    expect(el.playState).toBe('finished')

    const started = vi.fn()
    el.addEventListener('motion-start', started)
    el.replay()
    expect(el.style.opacity).toBe('1')
    expect(scrollMock).not.toHaveBeenCalled()
    expect(started).toHaveBeenCalledOnce()
  })

  it('once latch finishes playback and fires motion-finish', async () => {
    const el = await mount('in', 'true')
    const finished = waitForEvent(el, 'motion-finish')
    progress(1)
    await finished
    expect(el.playState).toBe('finished')
  })

  it('cancel() under reduced motion keeps the content visible', async () => {
    stubReducedMotion(true)
    const el = await mount()
    await elementUpdated(el)
    el.cancel()
    expect(el.style.opacity).toBe('1')
  })
})
