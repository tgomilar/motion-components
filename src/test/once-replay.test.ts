import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { unsafeStatic, html as staticHtml } from 'lit/static-html.js'
import { stubIntersectionObserver, stubReducedMotion, type IntersectionHandle } from './helpers.js'
import type { MotionControllable } from '../utils/playback.types.js'
import '../reveal/motion-reveal/motion-reveal.js'
import '../reveal/motion-blur-in/motion-blur-in.js'
import '../reveal/motion-stagger/motion-stagger.js'
import '../text/motion-split/motion-split.js'
import '../text/motion-headline/motion-headline.js'
import '../text/motion-text-mask/motion-text-mask.js'
import '../text/motion-font/motion-font.js'

const TAGS = [
  'motion-reveal',
  'motion-blur-in',
  'motion-stagger',
  'motion-split',
  'motion-headline',
  'motion-text-mask',
  'motion-font',
]

describe('once="false" replays on every entry', () => {
  let io: IntersectionHandle

  beforeEach(() => {
    stubReducedMotion(false)
    io = stubIntersectionObserver()
  })

  for (const tag of TAGS) {
    it(tag, async () => {
      const t = unsafeStatic(tag)
      const el = (await fixture(
        html`${staticHtml`<${t} once="false"><div>Hello world</div></${t}>`}`,
      )) as unknown as HTMLElement & MotionControllable
      const host = (el.matches(tag) ? el : el.querySelector(tag)) as HTMLElement &
        MotionControllable
      await elementUpdated(host)

      io.enter()
      expect(host.playState).not.toBe('idle')
      host.finish()
      expect(host.playState).toBe('finished')

      io.leave()
      expect(host.playState).toBe('idle')

      io.enter()
      expect(host.playState).toBe('running')
    })
  }

  it('once (default) does not replay', async () => {
    const el = (await fixture(
      html`<motion-reveal><div>Hello</div></motion-reveal>`,
    )) as unknown as HTMLElement & MotionControllable
    io.enter()
    el.finish()
    io.leave()
    io.enter()
    expect(el.playState).toBe('finished')
  })
})
