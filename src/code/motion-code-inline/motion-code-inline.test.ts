import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion } from '../../test/helpers.js'
import type { MotionCodeInline } from './motion-code-inline.js'
import './motion-code-inline.js'

describe('motion-code-inline', () => {
  beforeEach(() => stubReducedMotion(false))

  it('renders slotted text inside a code element', async () => {
    const el = (await fixture(
      html`<motion-code-inline>npm install</motion-code-inline>`,
    )) as MotionCodeInline
    const code = el.shadowRoot?.querySelector('code')
    expect(code).toBeTruthy()
    expect(code?.querySelector('slot')).toBeTruthy()
    expect(el.textContent).toBe('npm install')
  })

  it('has no copy button by default', async () => {
    const el = (await fixture(html`<motion-code-inline>x</motion-code-inline>`)) as MotionCodeInline
    expect(el.shadowRoot?.querySelector('button')).toBeNull()
  })

  it('renders a copy button when copy is set', async () => {
    const el = (await fixture(
      html`<motion-code-inline copy>x</motion-code-inline>`,
    )) as MotionCodeInline
    await elementUpdated(el)
    const btn = el.shadowRoot?.querySelector('button')
    expect(btn).toBeTruthy()
    expect(btn?.getAttribute('aria-label')).toBe('Copy')
  })

  it('copy-visible renders the button and reflects the attribute', async () => {
    const el = (await fixture(
      html`<motion-code-inline copy-visible>x</motion-code-inline>`,
    )) as MotionCodeInline
    await elementUpdated(el)
    expect(el.copyVisible).toBe(true)
    expect(el.hasAttribute('copy-visible')).toBe(true)
    expect(el.shadowRoot?.querySelector('button')).toBeTruthy()
  })

  it('clicking copy writes the trimmed text and flips the aria-label', async () => {
    const written: string[] = []
    const spy = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockImplementation((t: string) => (written.push(t), Promise.resolve()))

    const el = (await fixture(
      html`<motion-code-inline copy> spaced </motion-code-inline>`,
    )) as MotionCodeInline
    await elementUpdated(el)
    const btn = el.shadowRoot?.querySelector('button') as HTMLButtonElement
    btn.click()
    await elementUpdated(el)
    expect(written).toEqual(['spaced'])
    expect(btn.getAttribute('aria-label')).toBe('Copied')
    spy.mockRestore()
  })

  it('keeps a hover-only copy button out of the text flow', async () => {
    const plain = (await fixture(
      html`<motion-code-inline>npm i x</motion-code-inline>`,
    )) as MotionCodeInline
    const hover = (await fixture(
      html`<motion-code-inline copy>npm i x</motion-code-inline>`,
    )) as MotionCodeInline
    const visible = (await fixture(
      html`<motion-code-inline copy-visible>npm i x</motion-code-inline>`,
    )) as MotionCodeInline
    await elementUpdated(hover)
    await elementUpdated(visible)
    const width = (el: HTMLElement) => el.getBoundingClientRect().width
    expect(width(hover)).toBeCloseTo(width(plain), 0)
    expect(width(visible)).toBeGreaterThan(width(plain) + 5)
  })

  it('morphs a decorative copy state icon into the check after copying', async () => {
    const spy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const el = (await fixture(
      html`<motion-code-inline copy-visible>npm i motion-components</motion-code-inline>`,
    )) as MotionCodeInline
    await elementUpdated(el)
    const icon = el.shadowRoot!.querySelector('motion-icon-state')!
    expect(icon.name).toBe('copy')
    expect(icon.active).toBe(false)
    expect(icon.getAttribute('aria-hidden')).toBe('true')
    el.shadowRoot!.querySelector('button')!.click()
    await elementUpdated(el)
    expect(icon.active).toBe(true)
    spy.mockRestore()
  })

  it('sizes the copy icon with the text', async () => {
    const el = (
      await fixture(
        html`<div style="font-size: 32px"
          ><motion-code-inline copy-visible>big</motion-code-inline></div
        >`,
      )
    ).querySelector('motion-code-inline') as MotionCodeInline
    await elementUpdated(el)
    const icon = el.shadowRoot!.querySelector('motion-icon-state')!
    await (icon as unknown as { updateComplete: Promise<boolean> }).updateComplete
    expect(icon.getBoundingClientRect().width).toBeCloseTo(32, 0)
  })
})
