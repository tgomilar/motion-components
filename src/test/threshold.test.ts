import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, elementUpdated } from '@open-wc/testing-helpers'
import { stubIntersectionObserver, stubReducedMotion } from './helpers.js'
import '../reveal/motion-stagger/motion-stagger.js'
import '../text/motion-split/motion-split.js'
import '../text/motion-counter/motion-counter.js'
import '../text/motion-swap/motion-swap.js'
import '../text/motion-font/motion-font.js'
import '../text/motion-scramble/motion-scramble.js'
import '../text/motion-typewriter/motion-typewriter.js'
import '../text/motion-gravity/motion-gravity.js'
import '../code/motion-code/motion-code.js'
import '../charts/motion-chart/motion-chart.js'
import '../charts/motion-pie/motion-pie.js'
import '../charts/motion-sparkline/motion-sparkline.js'
import '../icons/motion-icon/motion-icon.js'

const CASES: [tag: string, markup: string][] = [
  [
    'motion-stagger',
    '<motion-stagger threshold="0.65"><div>One</div><div>Two</div></motion-stagger>',
  ],
  ['motion-split', '<motion-split threshold="0.65">Hello world</motion-split>'],
  ['motion-counter', '<motion-counter threshold="0.65" to="10"></motion-counter>'],
  ['motion-swap', '<motion-swap trigger="view" threshold="0.65">Hello</motion-swap>'],
  ['motion-font', '<motion-font threshold="0.65">Hello</motion-font>'],
  ['motion-scramble', '<motion-scramble threshold="0.65">Hello</motion-scramble>'],
  ['motion-typewriter', '<motion-typewriter threshold="0.65">Hello</motion-typewriter>'],
  ['motion-gravity', '<motion-gravity trigger="view" threshold="0.65">Hello</motion-gravity>'],
  [
    'motion-code',
    '<motion-code typing typing-loop="false" threshold="0.65"><script type="text/plain">let x = 1</script></motion-code>',
  ],
  ['motion-chart', '<motion-chart threshold="0.65" values="1, 2" labels="A, B"></motion-chart>'],
  ['motion-pie', '<motion-pie threshold="0.65" values="1, 2" labels="A, B"></motion-pie>'],
  ['motion-sparkline', '<motion-sparkline threshold="0.65" values="1, 3, 2"></motion-sparkline>'],
  [
    'motion-icon',
    '<motion-icon trigger="view" threshold="0.65"><svg viewBox="0 0 24 24"><path d="M4 12h16" /></svg></motion-icon>',
  ],
]

describe('threshold reaches the IntersectionObserver', () => {
  let thresholds: unknown[]

  beforeEach(() => {
    stubReducedMotion(false)
    stubIntersectionObserver()
    const Fake = window.IntersectionObserver
    thresholds = []
    window.IntersectionObserver = class extends Fake {
      constructor(cb: IntersectionObserverCallback, init?: IntersectionObserverInit) {
        super(cb, init)
        thresholds.push(init?.threshold)
      }
    }
  })

  for (const [tag, markup] of CASES) {
    it(tag, async () => {
      const host = document.createElement('div')
      host.innerHTML = markup
      const el = await fixture(host.firstElementChild!)
      await elementUpdated(el)
      await new Promise((resolve) => requestAnimationFrame(resolve))
      expect(thresholds).toContain(0.65)
    })
  }
})
