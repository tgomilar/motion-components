import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion, waitForEvent } from '../../test/helpers.js'
import type { MotionDialog } from './motion-dialog.js'
import './motion-dialog.js'

const nativeDialog = (el: MotionDialog) => el.shadowRoot!.querySelector('dialog')!

describe('motion-dialog', () => {
  beforeEach(() => stubReducedMotion(false))

  async function mount() {
    return (await fixture(html`<motion-dialog><p>Body</p></motion-dialog>`)) as MotionDialog
  }

  it('show() opens the native dialog and reflects `open`', async () => {
    const el = await mount()
    el.show()
    await elementUpdated(el)
    expect(el.open).toBe(true)
    expect(el.hasAttribute('open')).toBe(true)
    expect(nativeDialog(el).open).toBe(true)
  })

  it('opens declaratively via the open attribute', async () => {
    const el = await mount()
    el.setAttribute('open', '')
    await elementUpdated(el)
    expect(nativeDialog(el).open).toBe(true)
  })

  it('close() runs the exit and fires motion-close', async () => {
    stubReducedMotion(true) // reduced path closes synchronously — deterministic
    const el = await mount()
    el.show()
    await elementUpdated(el)
    expect(nativeDialog(el).open).toBe(true)

    const closed = waitForEvent(el, 'motion-close')
    el.close()
    await elementUpdated(el)
    await closed
    expect(nativeDialog(el).open).toBe(false)
  })

  it('stays open when reopened during the exit animation', async () => {
    const el = await mount()
    el.show()
    await elementUpdated(el)
    el.close()
    await elementUpdated(el)
    expect(nativeDialog(el).open).toBe(true)
    el.show()
    await elementUpdated(el)
    await new Promise((r) => setTimeout(r, 900))
    expect(el.open).toBe(true)
    expect(nativeDialog(el).open).toBe(true)
    expect(Number(getComputedStyle(nativeDialog(el)).opacity)).toBeGreaterThan(0.9)
  })

  it('draws the backdrop in the top layer, so an ancestor with backdrop-filter cannot clip it', async () => {
    stubReducedMotion(true)
    const wrap = document.createElement('div')
    wrap.style.cssText = 'height: 40px; backdrop-filter: blur(2px)'
    wrap.innerHTML = '<motion-dialog><p>Hi</p></motion-dialog>'
    const el = (await fixture(wrap)).querySelector('motion-dialog') as MotionDialog
    el.show()
    await elementUpdated(el)
    const backdrop = getComputedStyle(nativeDialog(el), '::backdrop')
    expect(backdrop.opacity).toBe('1')
    expect(backdrop.backdropFilter).toBe('blur(6px)')
  })

  it('no-backdrop hides the overlay and reflects the attribute', async () => {
    const el = await mount()
    el.noBackdrop = true
    await elementUpdated(el)
    expect(el.hasAttribute('no-backdrop')).toBe(true)

    stubReducedMotion(true)
    el.show()
    await elementUpdated(el)
    expect(getComputedStyle(nativeDialog(el), '::backdrop').display).toBe('none')
  })

  it('light-dismiss closes when clicking outside the panel', async () => {
    stubReducedMotion(true)
    const el = await mount()
    el.lightDismiss = true
    el.show()
    await elementUpdated(el)
    expect(nativeDialog(el).open).toBe(true)

    document.dispatchEvent(
      new MouseEvent('click', { clientX: 99999, clientY: 99999, bubbles: true }),
    )
    await elementUpdated(el)
    expect(el.open).toBe(false)
  })

  it('light-dismiss ignores keyboard clicks on buttons inside the panel', async () => {
    stubReducedMotion(true)
    const el = (await fixture(
      html`<motion-dialog light-dismiss><button>OK</button></motion-dialog>`,
    )) as MotionDialog
    el.show()
    await elementUpdated(el)

    // Enter or Space on a button fires a click with clientX and clientY of 0.
    el.querySelector('button')!.click()
    await elementUpdated(el)
    expect(el.open).toBe(true)
    expect(nativeDialog(el).open).toBe(true)
  })
})
