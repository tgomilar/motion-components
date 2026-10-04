import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fixture, elementUpdated } from '@open-wc/testing-helpers'
import { stubIntersectionObserver, stubReducedMotion } from '../../test/helpers.js'
import type { MotionIcon } from './motion-icon.js'
import './motion-icon.js'

const STROKE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16"/><path d="M12 4v16"/></svg>`
const FILLED = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v16H4z"/></svg>`

async function mount(attrs = '', inner = STROKE) {
  const host = document.createElement('div')
  host.innerHTML = `<motion-icon ${attrs}>${inner}</motion-icon>`
  const el = (await fixture(host.firstElementChild!)) as MotionIcon
  await elementUpdated(el)
  return el
}

const strokes = (el: MotionIcon) => [...el.querySelectorAll<SVGPathElement>('path')]

describe('motion-icon', () => {
  beforeEach(() => stubReducedMotion(false))

  it('is decorative by default and named with label', async () => {
    const el = await mount()
    expect(el.getAttribute('aria-hidden')).toBe('true')
    el.label = 'Add'
    await elementUpdated(el)
    expect(el.getAttribute('role')).toBe('img')
    expect(el.getAttribute('aria-label')).toBe('Add')
    expect(el.hasAttribute('aria-hidden')).toBe(false)
  })

  it('prepares stroke shapes for drawing and leaves them visible for hover', async () => {
    const el = await mount()
    for (const p of strokes(el)) {
      expect(p.getAttribute('pathLength')).toBe('1')
      expect(p.style.strokeDashoffset).toBe('0')
    }
  })

  it('draws the strokes in on hover', async () => {
    const el = await mount()
    el.dispatchEvent(new PointerEvent('pointerenter'))
    expect(el.playState).toBe('running')
    await el.finished
    expect(el.playState).toBe('finished')
    expect(Number(getComputedStyle(strokes(el)[0]).strokeDashoffset.replace('px', ''))).toBeCloseTo(
      0,
    )
  })

  it('starts hidden and draws in when scrolled into view', async () => {
    const io = stubIntersectionObserver()
    const el = await mount('trigger="view"')
    expect(strokes(el)[0].style.strokeDashoffset).toBe('1')
    io.enter()
    expect(el.playState).toBe('running')
  })

  it('draws and wiggles together with a combined animation', async () => {
    const io = stubIntersectionObserver()
    const el = await mount('trigger="view" animation="draw wiggle" duration="0.3"')
    expect(strokes(el)[0].style.strokeDashoffset).toBe('1')
    io.enter()
    expect(el.playState).toBe('running')
    await new Promise((r) => setTimeout(r, 120))
    const svg = el.querySelector('svg')!
    expect(getComputedStyle(svg).transform).not.toBe('none')
    await el.finished
    expect(Number(getComputedStyle(strokes(el)[0]).strokeDashoffset.replace('px', ''))).toBeCloseTo(
      0,
    )
  })

  it('runs only the motion of a combined animation on filled icons', async () => {
    const el = await mount('trigger="click" animation="draw wiggle"', FILLED)
    expect(el.querySelector('path')!.hasAttribute('pathLength')).toBe(false)
    el.click()
    expect(el.playState).toBe('running')
    await el.finished
    expect(el.querySelector('svg')!.style.fillOpacity).toBe('')
  })

  it('prepares strokes while slotted into a component that has not rendered yet', async () => {
    const host = document.createElement('div')
    host.attachShadow({ mode: 'open' })
    host.innerHTML = `<motion-icon trigger="view">${STROKE}</motion-icon>`
    document.body.append(host)
    const el = host.querySelector('motion-icon') as MotionIcon
    await elementUpdated(el)
    expect(strokes(el).every((p) => p.getAttribute('pathLength') === '1')).toBe(true)
    expect(strokes(el)[0].style.strokeDashoffset).toBe('1')
    host.remove()
  })

  it('falls back from draw to pop for filled icons', async () => {
    const el = await mount('trigger="click"', FILLED)
    expect(el.querySelector('path')!.hasAttribute('pathLength')).toBe(false)
    el.click()
    expect(el.playState).toBe('running')
  })

  it('renders an icon string and removes script and handlers', async () => {
    const el = await mount('', '')
    el.icon = `<svg viewBox="0 0 24 24" onload="alert(1)" stroke="currentColor"><script>alert(1)</script><path d="M4 12h16" onclick="alert(1)"/></svg>`
    await elementUpdated(el)
    const svg = el.shadowRoot!.querySelector('.icon svg')!
    expect(svg).not.toBeNull()
    expect(svg.hasAttribute('onload')).toBe(false)
    expect(svg.querySelector('script')).toBeNull()
    expect(svg.querySelector('path')!.hasAttribute('onclick')).toBe(false)
  })

  it('loops with a pause between runs', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const el = await mount('trigger="loop" interval="0.5"')
    el.finish()
    expect(el.playState).toBe('finished')
    vi.advanceTimersByTime(500)
    expect(el.playState).toBe('running')
    vi.useRealTimers()
    el.remove()
  })

  it('cancel() during the pause stops the loop', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const el = await mount('trigger="loop" interval="0.5"')
    el.finish()
    el.cancel()
    vi.advanceTimersByTime(1000)
    expect(el.playState).toBe('idle')
    vi.useRealTimers()
    el.remove()
  })

  it('shows the final state at once under reduced motion', async () => {
    stubReducedMotion(true)
    const el = await mount('trigger="mount"')
    expect(el.playState).toBe('finished')
    expect(strokes(el)[0].style.strokeDashoffset).toBe('0')
  })

  it('keeps only drawing elements and local references', async () => {
    const el = await mount('', '')
    el.icon = `<svg viewBox="0 0 24 24"><style>@import url(https://x.test/a.css)</style><image href="https://x.test/a.png"/><a href="https://x.test"><path d="M1 1"/></a><animate attributeName="d"/><defs><linearGradient id="g"/></defs><path d="M4 12h16" fill="url(#g)" style="fill: url(https://x.test/b)"/><use href="#g"/></svg>`
    await elementUpdated(el)
    const svg = el.shadowRoot!.querySelector('.icon svg')!
    expect(svg.querySelector('style, image, a, animate')).toBeNull()
    const path = svg.querySelector('path')!
    expect(path.getAttribute('fill')).toBe('url(#g)')
    expect(path.hasAttribute('style')).toBe(false)
    expect(svg.querySelector('use')!.getAttribute('href')).toBe('#g')
  })

  it('removes style attributes and escaped external references', async () => {
    const el = await mount('', '')
    el.icon = `<svg viewBox="0 0 24 24" style="background: red"><path d="M1 1" style="fill: none"/><path d="M2 2" fill="u\\72l(https://x.test/a)"/><path d="M3 3" mask="\\75 rl(//x.test/m)"/><path d="M4 4" filter="-webkit-image-set('https://x.test/i' 1x)"/><path d="M5 5" clip-path="url(&quot;#c&quot;)"/></svg>`
    await elementUpdated(el)
    const svg = el.shadowRoot!.querySelector('.icon svg')!
    const paths = svg.querySelectorAll('path')
    expect(svg.hasAttribute('style')).toBe(false)
    expect(paths[0].hasAttribute('style')).toBe(false)
    expect(paths[1].hasAttribute('fill')).toBe(false)
    expect(paths[2].hasAttribute('mask')).toBe(false)
    expect(paths[3].hasAttribute('filter')).toBe(false)
    expect(paths[4].getAttribute('clip-path')).toBe('url("#c")')
  })

  it('fills icons without a fill with currentColor', async () => {
    const el = await mount('', '')
    el.icon = `<svg viewBox="0 0 24 24" width="48" height="48"><path d="M4 4h16v16H4z"/></svg>`
    await elementUpdated(el)
    const svg = el.shadowRoot!.querySelector('.icon svg')!
    expect(svg.getAttribute('fill')).toBe('currentColor')
    expect(svg.hasAttribute('width')).toBe(false)
  })

  it('hides the child svg once icon renders', async () => {
    const el = await mount()
    el.icon = FILLED
    await elementUpdated(el)
    const slot = el.shadowRoot!.querySelector('slot')!
    expect(getComputedStyle(slot).display).toBe('none')
  })

  it('loads src once per URL and renders it', async () => {
    const fetch = vi.fn(async () => new Response(STROKE))
    vi.stubGlobal('fetch', fetch)
    const a = await mount('src="/icons/plus.svg"', '')
    const b = await mount('src="/icons/plus.svg"', '')
    await vi.waitFor(() => expect(a.shadowRoot!.querySelector('.icon svg')).not.toBeNull())
    await vi.waitFor(() => expect(b.shadowRoot!.querySelector('.icon svg')).not.toBeNull())
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(a.shadowRoot!.querySelector('path')!.getAttribute('pathLength')).toBe('1')
    vi.unstubAllGlobals()
  })

  it('fires error when src fails', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 404 }))
    const el = await mount('', '')
    const error = new Promise((resolve) => el.addEventListener('error', resolve))
    el.src = '/icons/missing.svg'
    await error
    expect(el.shadowRoot!.querySelector('.icon svg')).toBeNull()
    vi.unstubAllGlobals()
  })

  it('follows hover and click on the surrounding button', async () => {
    const host = document.createElement('div')
    host.innerHTML = `<button><motion-icon trigger="click">${STROKE}</motion-icon> Save</button>`
    const button = (await fixture(host.firstElementChild!)) as HTMLButtonElement
    const el = button.querySelector('motion-icon') as MotionIcon
    await elementUpdated(el)
    button.click()
    expect(el.playState).toBe('running')
    el.cancel()
    el.trigger = 'hover'
    await elementUpdated(el)
    button.dispatchEvent(new PointerEvent('pointerenter'))
    expect(el.playState).toBe('running')
  })

  it('fills outline icons with --icon-fill and fades the fill in when drawing', async () => {
    const io = stubIntersectionObserver()
    const el = await mount('trigger="view" style="--icon-fill: rgb(255, 0, 0)"')
    const svg = el.querySelector('svg')!
    expect(getComputedStyle(svg).fill).toBe('rgb(255, 0, 0)')
    expect(svg.style.fillOpacity).toBe('0')
    io.enter()
    await el.finished
    expect(getComputedStyle(svg).fillOpacity).toBe('1')
  })

  it('keeps outline icons hollow without --icon-fill', async () => {
    const el = await mount()
    expect(getComputedStyle(el.querySelector('svg')!).fill).toBe('none')
  })

  it('draws in when scrolled into view after it is removed and added back', async () => {
    const io = stubIntersectionObserver()
    const el = await mount('trigger="view"')
    const parent = el.parentElement!
    el.remove()
    parent.append(el)
    await elementUpdated(el)
    io.enter()
    expect(el.playState).toBe('running')
  })
})
