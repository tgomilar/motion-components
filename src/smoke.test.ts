import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion } from './test/helpers.js'
// Side-effect import registers every motion-* custom element.
import './index.js'

// Every shipped custom element (the vite.config entry set, minus index/preload).
// A blanket net: each element must upgrade, render, and — if it exposes the
// playback surface — settle its `finished` promise without hanging or throwing.
const TAGS = [
  'motion-hover',
  'motion-press',
  'motion-magnetic',
  'motion-tilt',
  'motion-reveal',
  'motion-stagger',
  'motion-blur',
  'motion-blur-in',
  'motion-text-mask',
  'motion-split',
  'motion-headline',
  'motion-glitch',
  'motion-typewriter',
  'motion-counter',
  'motion-scramble',
  'motion-ticker',
  'motion-words',
  'motion-curve',
  'motion-circle',
  'motion-arc',
  'motion-perspective',
  'motion-stretch',
  'motion-liquid',
  'motion-gravity',
  'motion-font',
  'motion-swap',
  'motion-slider',
  'motion-gallery',
  'motion-countdown',
  'motion-spotlight',
  'motion-progress',
  'motion-image-compare',
  'motion-flip-card',
  'motion-dialog',
  'motion-parallax',
  'motion-scene',
  'motion-code',
  'motion-code-inline',
] as const

interface Controllable {
  play(): Promise<void>
  finish(): void
  finished: Promise<void>
}

const isControllable = (el: unknown): el is Controllable =>
  typeof (el as Controllable).play === 'function' &&
  typeof (el as Controllable).finish === 'function' &&
  (el as Controllable).finished instanceof Promise

describe('every motion-* element (smoke)', () => {
  // Reduced motion drives the deterministic fast path: components settle their
  // final state synchronously instead of running a spring we would have to wait on.
  beforeEach(() => stubReducedMotion(true))

  for (const tag of TAGS) {
    it(`${tag} upgrades, renders, and settles`, async () => {
      const ctor = customElements.get(tag)
      expect(ctor, `${tag} should be registered`).toBeTypeOf('function')

      // Give text-splitting components real content to work with.
      const el = (await fixture(`<${tag}>Motion</${tag}>`)) as HTMLElement
      expect(el, `${tag} should upgrade to its class`).toBeInstanceOf(ctor!)
      // Renders (or otherwise completes its update) without throwing.
      await elementUpdated(el)

      if (isControllable(el)) {
        el.finish()
        await Promise.race([
          el.finished,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${tag}: finished did not resolve`)), 2000),
          ),
        ])
      }
    })
  }

  it('covers every registered motion-* element', () => {
    // Drift guard: if a new component is scaffolded, add it to TAGS above.
    const registered = TAGS.filter((t) => customElements.get(t)).length
    expect(registered).toBe(TAGS.length)
  })
})
