import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion } from '../../test/helpers.js'

// Each swap runs exit, width and enter springs through Motion; the contract is
// the keyframes and spring options handed to `animate`, so it is mocked.
const { animateMock, controls } = vi.hoisted(() => {
  const controls: {
    pause: () => void
    play: () => void
    complete: () => void
    cancel: () => void
    resolve: () => void
  }[] = []
  const animateMock = vi.fn((..._args: unknown[]) => {
    let resolve!: () => void
    const done = new Promise<void>((r) => (resolve = r))
    const c = {
      pause: vi.fn(),
      play: vi.fn(),
      complete: vi.fn(() => resolve()),
      cancel: vi.fn(),
      resolve: () => resolve(),
      then: (ok: () => void, fail?: (e: unknown) => void) => done.then(ok, fail),
    }
    controls.push(c)
    return c
  })
  return { animateMock, controls }
})
vi.mock('motion', () => ({ animate: animateMock }))

import type { MotionWords } from './motion-words.js'
import './motion-words.js'

const last = () => controls[controls.length - 1]
const word = (el: MotionWords) => el.shadowRoot!.querySelector<HTMLElement>('.word')!

async function settle(el: MotionWords) {
  for (let i = 0; i < 5; i++) await Promise.resolve()
  await elementUpdated(el)
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe('motion-words', () => {
  beforeEach(() => {
    stubReducedMotion(false)
    animateMock.mockClear()
    controls.length = 0
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function mount(tpl = html`<motion-words words="ship, design, animate"></motion-words>`) {
    const el = (await fixture(tpl)) as MotionWords
    await elementUpdated(el)
    return el
  }

  it('has the documented defaults', async () => {
    const el = await mount()
    expect(el.interval).toBe(2)
    expect(el.colors).toBe('')
  })

  it('renders the first word as readable text that inherits the host color', async () => {
    const el = await mount()
    el.style.color = 'rgb(1, 2, 3)'
    expect(word(el).textContent).toBe('ship')
    expect(getComputedStyle(word(el)).color).toBe('rgb(1, 2, 3)')
  })

  it('applies the matching color from `colors`', async () => {
    const el = await mount(
      html`<motion-words words="a, b" colors="#ff0000, #0000ff"></motion-words>`,
    )
    expect(word(el).style.color).toBe('rgb(255, 0, 0)')
  })

  it('starts running on connect when there is more than one word', async () => {
    const el = await mount()
    expect(el.playState).toBe('running')
  })

  it('stays idle with a single word', async () => {
    const el = await mount(html`<motion-words words="solo"></motion-words>`)
    expect(el.playState).toBe('idle')
    await vi.advanceTimersByTimeAsync(5000)
    expect(animateMock).not.toHaveBeenCalled()
  })

  it('waits `interval` seconds, then springs the word out', async () => {
    const el = await mount(html`<motion-words words="a, b" interval="1"></motion-words>`)
    await vi.advanceTimersByTimeAsync(999)
    expect(animateMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(animateMock).toHaveBeenCalledOnce()
    const [target, keyframes, options] = animateMock.mock.calls[0]
    expect(target).toBe(word(el))
    expect(keyframes).toEqual({ y: -16, opacity: 0, filter: 'blur(8px)' })
    expect(options).toEqual({ type: 'spring', stiffness: 400, damping: 30 })
  })

  it('swaps to the next word, springing width and entering the new word', async () => {
    const el = await mount()
    await vi.advanceTimersByTimeAsync(2000)
    controls[0].resolve()
    await settle(el)
    expect(word(el).textContent).toBe('design')
    expect(animateMock).toHaveBeenCalledTimes(3)

    const [widthTarget, widthKeyframes, widthOptions] = animateMock.mock.calls[1]
    expect(widthTarget).toBe(el)
    expect(widthKeyframes).toMatchObject({ width: [expect.any(String), expect.any(String)] })
    expect(widthOptions).toEqual({ type: 'spring', stiffness: 300, damping: 32 })

    const [enterTarget, enterKeyframes, enterOptions] = animateMock.mock.calls[2]
    expect(enterTarget).toBe(word(el))
    expect(enterKeyframes).toEqual({
      y: [16, 0],
      opacity: [0, 1],
      filter: ['blur(8px)', 'blur(0px)'],
    })
    expect(enterOptions).toEqual({ type: 'spring', stiffness: 320, damping: 40 })
  })

  it('wraps around to the first word', async () => {
    const el = await mount(html`<motion-words words="a, b"></motion-words>`)
    for (const expected of ['b', 'a']) {
      await vi.advanceTimersByTimeAsync(2000)
      last().resolve()
      await settle(el)
      last().resolve()
      await settle(el)
      expect(word(el).textContent).toBe(expected)
    }
  })

  it('pause() holds the timer and active springs; play() resumes them', async () => {
    const el = await mount()
    await vi.advanceTimersByTimeAsync(2000)
    el.pause()
    expect(el.playState).toBe('paused')
    expect(controls[0].pause).toHaveBeenCalled()

    void el.play()
    expect(el.playState).toBe('running')
    expect(controls[0].play).toHaveBeenCalled()
  })

  it('pause() between swaps keeps the remaining time', async () => {
    const el = await mount()
    await vi.advanceTimersByTimeAsync(1500)
    el.pause()
    await vi.advanceTimersByTimeAsync(5000)
    expect(animateMock).not.toHaveBeenCalled()
    void el.play()
    await vi.advanceTimersByTimeAsync(499)
    expect(animateMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(animateMock).toHaveBeenCalledOnce()
  })

  it('finish() completes active springs, clears styles and stops cycling', async () => {
    const el = await mount()
    await vi.advanceTimersByTimeAsync(2000)
    el.finish()
    expect(controls[0].complete).toHaveBeenCalled()
    expect(el.playState).toBe('finished')
    expect(el.style.width).toBe('')
    await vi.advanceTimersByTimeAsync(10000)
    expect(animateMock).toHaveBeenCalledOnce()
  })

  it('cancel() stops cycling and returns to the first word', async () => {
    const el = await mount()
    await vi.advanceTimersByTimeAsync(2000)
    controls[0].resolve()
    await settle(el)
    expect(word(el).textContent).toBe('design')

    el.cancel()
    await elementUpdated(el)
    expect(last().cancel).toHaveBeenCalled()
    expect(el.playState).toBe('idle')
    expect(word(el).textContent).toBe('ship')
  })

  it('under reduced motion, swaps words instantly without animating', async () => {
    stubReducedMotion(true)
    const el = await mount()
    expect(el.playState).toBe('running')
    await vi.advanceTimersByTimeAsync(2000)
    await elementUpdated(el)
    expect(word(el).textContent).toBe('design')
    expect(animateMock).not.toHaveBeenCalled()
  })

  it('under reduced motion, pause(), play() and cancel() control the cycle', async () => {
    stubReducedMotion(true)
    const el = await mount()
    await vi.advanceTimersByTimeAsync(1500)
    el.pause()
    expect(el.playState).toBe('paused')
    await vi.advanceTimersByTimeAsync(5000)
    await elementUpdated(el)
    expect(word(el).textContent).toBe('ship')

    void el.play()
    expect(el.playState).toBe('running')
    await vi.advanceTimersByTimeAsync(500)
    await elementUpdated(el)
    expect(word(el).textContent).toBe('design')

    const cancelled = vi.fn()
    el.addEventListener('motion-cancel', cancelled)
    el.cancel()
    await elementUpdated(el)
    expect(el.playState).toBe('idle')
    expect(cancelled).toHaveBeenCalledOnce()
    expect(word(el).textContent).toBe('ship')
    await vi.advanceTimersByTimeAsync(5000)
    await elementUpdated(el)
    expect(word(el).textContent).toBe('ship')
    expect(animateMock).not.toHaveBeenCalled()
  })

  it('under reduced motion, finish() stops on the current word', async () => {
    stubReducedMotion(true)
    const el = await mount()
    const finished = vi.fn()
    el.addEventListener('motion-finish', finished)
    await vi.advanceTimersByTimeAsync(2000)
    el.finish()
    expect(el.playState).toBe('finished')
    expect(finished).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(5000)
    await elementUpdated(el)
    expect(word(el).textContent).toBe('design')
  })

  it('stops cycling when disconnected', async () => {
    const el = await mount()
    el.remove()
    await vi.advanceTimersByTimeAsync(10000)
    expect(animateMock).not.toHaveBeenCalled()
  })

  it('keeps commas inside color functions', async () => {
    const el = await mount(
      html`<motion-words
        words="one, two"
        colors="rgb(255, 0, 0), hsl(120, 100%, 25%)"
      ></motion-words>`,
    )
    expect(word(el).style.color).toBe('rgb(255, 0, 0)')
  })

  it('falls back to currentColor without colors', async () => {
    const el = await mount()
    expect(word(el).style.color).toBe('currentcolor')
  })

  it('picks up a new word list', async () => {
    const el = await mount()
    el.words = 'alpha, beta'
    await settle(el)
    expect(word(el).textContent).toBe('alpha')
  })
})
