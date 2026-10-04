import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion, waitForEvent } from '../../test/helpers.js'

// The drop runs through Motion's spring; the contract is the targets, keyframes,
// stagger and spring options handed to `animate`, so we mock it. `then` lets a
// test settle the run the way a finished Motion animation would.
const { animateMock, staggerMock, settle } = vi.hoisted(() => {
  const settle = { run: () => {} }
  return {
    settle,
    animateMock: vi.fn((..._args: unknown[]) => ({
      then: (cb: () => void) => {
        settle.run = cb
      },
      pause: vi.fn(),
      play: vi.fn(),
      complete: vi.fn(),
      cancel: vi.fn(),
    })),
    staggerMock: vi.fn((each: number, opts: object) => ({ each, ...opts })),
  }
})
vi.mock('motion', () => ({ animate: animateMock, stagger: staggerMock }))

import type { MotionGravity } from './motion-gravity.js'
import './motion-gravity.js'

type Controls = ReturnType<typeof animateMock>

const chars = (el: MotionGravity) => [...el.shadowRoot!.querySelectorAll<HTMLElement>('.char')]
const lastControls = () =>
  animateMock.mock.results[animateMock.mock.results.length - 1].value as Controls

describe('motion-gravity', () => {
  beforeEach(() => {
    stubReducedMotion(false)
    animateMock.mockClear()
    staggerMock.mockClear()
  })

  async function mount(attrs = '', text = 'GO UP') {
    const host = document.createElement('div')
    host.innerHTML = `<motion-gravity ${attrs}>${text}</motion-gravity>`
    return (await fixture(host.firstElementChild!)) as MotionGravity
  }

  it('renders one span per character from child text, with spaces between words', async () => {
    const el = await mount()
    expect(el.text).toBe('GO UP')
    expect(el.textContent).toBe('')
    expect(chars(el).map((c) => c.textContent)).toEqual(['G', 'O', 'U', 'P'])
    expect(el.shadowRoot!.querySelector('[aria-hidden="true"]')!.textContent!.trim()).toBe('GO UP')
  })

  it('prefers the text attribute over child text', async () => {
    const el = await mount('text="HI"', 'ignored')
    expect(chars(el).map((c) => c.textContent)).toEqual(['H', 'I'])
  })

  it('has defaults: height 60, interval 0.05, duration 0.6, bounce 0.45, delay 0', async () => {
    const el = await mount()
    expect(el.height).toBe(60)
    expect(el.interval).toBe(0.05)
    expect(el.bounce).toBe(0.45)
    expect(el.duration).toBe(0.6)
    expect(el.delay).toBe(0)
  })

  it('drops every character in on mount with a staggered spring', async () => {
    const el = await mount('height="80" interval="0.1" duration="0.9" bounce="0.3" delay="0.2"')
    expect(el.playState).toBe('running')
    expect(animateMock).toHaveBeenCalledOnce()
    const [targets, keyframes, options] = animateMock.mock.calls[0]
    expect(targets).toEqual(chars(el))
    expect(keyframes).toEqual({ y: [-80, 0], opacity: [0, 1] })
    expect(staggerMock).toHaveBeenCalledWith(0.1, { startDelay: 0.2 })
    expect(options).toEqual({
      delay: { each: 0.1, startDelay: 0.2 },
      duration: 0.9,
      type: 'spring',
      bounce: 0.3,
    })
  })

  it('settles to finished when the drop completes', async () => {
    const el = await mount()
    const finished = waitForEvent(el, 'motion-finish')
    settle.run()
    await finished
    expect(el.playState).toBe('finished')
  })

  it('pause() and play() pause and resume the drop', async () => {
    const el = await mount()
    const controls = lastControls()
    el.pause()
    expect(el.playState).toBe('paused')
    expect(controls.pause).toHaveBeenCalledOnce()
    void el.play()
    expect(el.playState).toBe('running')
    expect(controls.play).toHaveBeenCalledOnce()
  })

  it('finish() completes the drop', async () => {
    const el = await mount()
    el.finish()
    expect(lastControls().complete).toHaveBeenCalledOnce()
    expect(el.playState).toBe('finished')
  })

  it('cancel() lifts characters back to their start and idles', async () => {
    const el = await mount('height="40"')
    el.cancel()
    expect(lastControls().cancel).toHaveBeenCalledOnce()
    expect(el.playState).toBe('idle')
    for (const c of chars(el)) {
      expect(c.style.opacity).toBe('0')
      expect(c.style.transform).toBe('translateY(-40px)')
    }
  })

  it('replay() cancels and drops again', async () => {
    const el = await mount()
    const first = lastControls()
    el.replay()
    expect(first.cancel).toHaveBeenCalledOnce()
    expect(animateMock).toHaveBeenCalledTimes(2)
    expect(el.playState).toBe('running')
  })

  it('replays with the new value when a drop attribute changes', async () => {
    const el = await mount()
    el.setAttribute('height', '120')
    await elementUpdated(el)
    expect(animateMock).toHaveBeenCalledTimes(2)
    expect(animateMock.mock.calls[1][1]).toEqual({ y: [-120, 0], opacity: [0, 1] })
  })

  it('under reduced motion, shows the text at rest without animating', async () => {
    stubReducedMotion(true)
    const el = await mount()
    expect(animateMock).not.toHaveBeenCalled()
    expect(el.playState).toBe('finished')
    for (const c of chars(el)) {
      expect(c.style.opacity).toBe('1')
      expect(c.style.transform).toBe('')
    }
  })

  it('renders nothing for empty text', async () => {
    const el = (await fixture(html`<motion-gravity></motion-gravity>`)) as MotionGravity
    expect(chars(el)).toHaveLength(0)
    expect(animateMock).not.toHaveBeenCalled()
  })

  it('exposes the full text to screen readers once', async () => {
    const el = await mount('text="Drop"')
    expect(el.shadowRoot!.querySelector('.sr-only')!.textContent).toBe('Drop')
    expect(el.shadowRoot!.querySelector('.char')!.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('finishes at once when there is no text', async () => {
    const el = await mount('', '')
    await el.finished
    expect(el.playState).toBe('finished')
  })
})
