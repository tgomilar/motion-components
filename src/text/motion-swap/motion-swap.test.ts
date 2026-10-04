import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion, stubIntersectionObserver } from '../../test/helpers.js'
import type { IntersectionHandle } from '../../test/helpers.js'
import type { MotionSwap } from './motion-swap.js'
import './motion-swap.js'

// Char pairs are split into the light DOM inside `aria-hidden` groups, next to
// a visually hidden copy of the text for screen readers.
const visual = (el: Element) =>
  [...el.children].filter((c) => c.getAttribute('aria-hidden') === 'true')

const text = (el: MotionSwap) =>
  visual(el)
    .map((c) => c.textContent)
    .join('')

/** Text nodes a screen reader reaches: everything outside `aria-hidden`. */
const readable = (el: Element) => {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const out: string[] = []
  while (walker.nextNode()) {
    const node = walker.currentNode
    if (node.textContent!.trim() && !node.parentElement!.closest('[aria-hidden="true"]')) {
      out.push(node.textContent!)
    }
  }
  return out
}

describe('motion-swap', () => {
  let io: IntersectionHandle

  beforeEach(() => {
    stubReducedMotion(false)
    io = stubIntersectionObserver()
  })

  it('splits text into per-character pairs and becomes ready', async () => {
    const el = (await fixture(html`<motion-swap>Hello</motion-swap>`)) as MotionSwap
    await elementUpdated(el)
    expect(el.hasAttribute('data-ready')).toBe(true)
    // Each visible character appears twice (original + duplicate) in the light DOM.
    expect(el.textContent).toContain('H')
    expect(el.textContent).toContain('o')
  })

  it('preserves word spacing across a multi-word phrase', async () => {
    const el = (await fixture(
      html`<motion-swap trigger="reveal">Hi there</motion-swap>`,
    )) as MotionSwap
    await elementUpdated(el)
    // Each char is doubled (original + duplicate span); the inter-word space is
    // kept as its own span, so the two words stay separated.
    expect(text(el)).toBe('HHii tthheerree')
  })

  it('wraps lines between words, never inside a word', async () => {
    const el = (await fixture(
      html`<div style="width: 7ch; font: 20px monospace"
        ><motion-swap>Smooth swaps</motion-swap></div
      >`,
    )) as HTMLElement
    const swap = el.querySelector('motion-swap')!
    await elementUpdated(swap as MotionSwap)
    const words = visual(swap).filter((c) => c.textContent!.trim())
    expect(words.map((w) => w.textContent)).toEqual(['SSmmooootthh', 'sswwaappss'])
    const tops = words.map((w) => w.getBoundingClientRect().top)
    expect(tops[1]).toBeGreaterThan(tops[0])
    for (const word of words) {
      const letters = [...word.children].map((c) => c.getBoundingClientRect().top)
      expect(new Set(letters).size).toBe(1)
    }
  })

  it('starts on viewport entry in reveal mode', async () => {
    const el = (await fixture(
      html`<motion-swap trigger="reveal">Hello</motion-swap>`,
    )) as MotionSwap
    await elementUpdated(el)
    expect(el.playState).toBe('idle')
    io.enter()
    expect(el.playState).toBe('running')
  })

  it('reads the text once, as whole words, to screen readers', async () => {
    const el = (await fixture(html`<motion-swap>Hi there</motion-swap>`)) as MotionSwap
    await elementUpdated(el)
    expect(readable(el)).toEqual(['Hi there'])
  })

  it('plays only on the first viewport entry by default', async () => {
    const el = (await fixture(html`<motion-swap trigger="view">Hello</motion-swap>`)) as MotionSwap
    await elementUpdated(el)
    io.enter()
    el.finish()
    io.leave()
    io.enter()
    expect(el.playState).toBe('finished')
  })

  it('swaps again on every viewport entry when once is false', async () => {
    const el = (await fixture(
      html`<motion-swap trigger="view" once="false">Hello</motion-swap>`,
    )) as MotionSwap
    await elementUpdated(el)
    io.enter()
    expect(el.playState).toBe('running')
    el.finish()
    io.leave()
    expect(el.playState).toBe('idle')
    io.enter()
    expect(el.playState).toBe('running')
  })

  it('does not observe the viewport in hover mode', async () => {
    const el = (await fixture(html`<motion-swap trigger="hover">Hello</motion-swap>`)) as MotionSwap
    await elementUpdated(el)
    io.enter()
    expect(el.playState).toBe('idle')
  })

  it('finish() drives playback to finished', async () => {
    const el = (await fixture(
      html`<motion-swap trigger="reveal">Hello</motion-swap>`,
    )) as MotionSwap
    await elementUpdated(el)
    io.enter()
    el.finish()
    expect(el.playState).toBe('finished')
    await expect(el.finished).resolves.toBeUndefined()
  })

  it('reflects the reverse property to an attribute', async () => {
    const el = (await fixture(html`<motion-swap>Hello</motion-swap>`)) as MotionSwap
    await elementUpdated(el)
    // reverse defaults to true and reflects.
    expect(el.hasAttribute('reverse')).toBe(true)
    el.reverse = false
    await elementUpdated(el)
    expect(el.hasAttribute('reverse')).toBe(false)
  })
})
