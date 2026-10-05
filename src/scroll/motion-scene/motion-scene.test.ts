import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion } from '../../test/helpers.js'

// motion-scene is scroll-driven; real scroll progress is not deterministically
// triggerable here. We mock motion's `scroll` and assert the wiring plus the
// deterministic data-driven state applied on finish().
const { scrollMock } = vi.hoisted(() => ({
  scrollMock: vi.fn((..._args: unknown[]) => () => {}),
}))
vi.mock('motion', () => ({ scroll: scrollMock }))

import type { MotionScene } from './motion-scene.js'
import './motion-scene.js'

describe('motion-scene', () => {
  beforeEach(() => {
    stubReducedMotion(false)
    scrollMock.mockClear()
  })

  async function mount() {
    return (await fixture(html`
      <motion-scene height="300vh">
        <div
          data-from='{"scale":0.8,"y":"40px"}'
          data-to='{"scale":1,"y":"0px"}'
          data-start="0"
          data-end="1"
        >
          Reveal
        </div>
      </motion-scene>
    `)) as MotionScene
  }

  it('renders the sticky inner stage and reflects height', async () => {
    const el = await mount()
    expect(el.shadowRoot?.querySelector('.inner')).toBeTruthy()
    expect(el.shadowRoot?.querySelector('slot')).toBeTruthy()
    expect(el.style.height).toBe('300vh')
    expect(el.pin).toBe(true)
  })

  it('binds a scroll driver per progress + child on connect', async () => {
    const el = await mount()
    expect(el.playState).toBe('running')
    // at least one driver for --mc-progress and one per animated child
    expect(scrollMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    const options = scrollMock.mock.calls[0][1] as { target: unknown; offset: unknown }
    expect(options.target).toBe(el)
    expect(options.offset).toEqual(['start start', 'end end'])
  })

  it('does not bind scroll when reduced motion is preferred, and shows the end state', async () => {
    stubReducedMotion(true)
    const el = await mount()
    expect(scrollMock).not.toHaveBeenCalled()
    expect(el.playState).toBe('idle')
    const child = el.querySelector('div') as HTMLElement
    expect(child.style.transform).toContain('scale(1)')
    expect(child.style.transform).toContain('translateY(0px)')
  })

  it('finish() applies the final (progress=1) child transform state', async () => {
    const el = await mount()
    el.finish()
    await elementUpdated(el)
    expect(el.style.getPropertyValue('--mc-progress')).toBe('1')
    const child = el.querySelector('div') as HTMLElement
    // at progress 1: scale -> 1, y -> 0px
    expect(child.style.transform).toContain('scale(1)')
    expect(child.style.transform).toContain('translateY(0px)')
    expect(el.playState).toBe('finished')
  })

  it('toggling pin updates the inner stage position', async () => {
    const el = await mount()
    el.pin = false
    await elementUpdated(el)
    const inner = el.shadowRoot?.querySelector<HTMLElement>('.inner')
    expect(inner?.style.position).toBe('relative')
  })
})
