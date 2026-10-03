import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fixture, fixtureCleanup, html, elementUpdated } from '@open-wc/testing-helpers'

const { animateMock, animateViewMock, viewNew } = vi.hoisted(() => {
  const viewNew = vi.fn()
  return {
    viewNew,
    animateMock: vi.fn((..._args: unknown[]) => ({
      stop: vi.fn(),
      then: (fn: () => void) => fn(),
    })),
    animateViewMock: vi.fn((update: () => void, _options?: unknown) => {
      update()
      return { new: viewNew }
    }),
  }
})
vi.mock('motion', () => ({ animate: animateMock, animateView: animateViewMock }))

import type { MotionThemeToggle } from './motion-theme-toggle.js'
import './motion-theme-toggle.js'

const root = document.documentElement

function stubMedia({ dark = false, reduce = false } = {}) {
  window.matchMedia = ((query: string) =>
    ({
      matches: query.includes('dark') ? dark : query.includes('reduced-motion') ? reduce : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList) as typeof window.matchMedia
}

const shadow = (el: MotionThemeToggle) => el.shadowRoot!
const button = (el: MotionThemeToggle, selector = 'button') =>
  shadow(el).querySelector<HTMLElement>(selector)!

async function mount(template: ReturnType<typeof html>) {
  const el = (await fixture(template)) as MotionThemeToggle
  await elementUpdated(el)
  return el
}

describe('motion-theme-toggle', () => {
  afterEach(() => fixtureCleanup())

  beforeEach(() => {
    localStorage.clear()
    delete root.dataset.theme
    root.style.colorScheme = ''
    stubMedia()
    animateMock.mockClear()
    animateViewMock.mockClear()
    viewNew.mockClear()
  })

  it('defaults to the OS preference and applies it to <html>', async () => {
    stubMedia({ dark: true })
    const el = await mount(html`<motion-theme-toggle></motion-theme-toggle>`)
    expect(el.mode).toBe('dark')
    expect(root.dataset.theme).toBe('dark')
    expect(root.style.colorScheme).toBe('dark')
  })

  it('icon appearance exposes a switch and toggles on click', async () => {
    const el = await mount(html`<motion-theme-toggle></motion-theme-toggle>`)
    const btn = button(el)
    expect(btn.getAttribute('role')).toBe('switch')
    expect(btn.getAttribute('aria-checked')).toBe('false')
    btn.click()
    await elementUpdated(el)
    expect(el.mode).toBe('dark')
    expect(btn.getAttribute('aria-checked')).toBe('true')
    expect(root.dataset.theme).toBe('dark')
  })

  it('fires colorschemechange only when the value changes', async () => {
    const events: CustomEvent[] = []
    const record = (e: CustomEvent) => events.push(e)
    const el = await mount(
      html`<motion-theme-toggle @colorschemechange=${record}></motion-theme-toggle>`,
    )
    expect(events[events.length - 1]?.detail).toEqual({ colorScheme: 'light', mode: 'light' })
    const count = events.length
    el.mode = 'light'
    await elementUpdated(el)
    expect(events.length).toBe(count)
    el.mode = 'dark'
    await elementUpdated(el)
    expect(events[events.length - 1]?.detail).toEqual({ colorScheme: 'dark', mode: 'dark' })
  })

  it('system cycles light → dark → system and resolves to the OS scheme', async () => {
    stubMedia({ dark: true })
    const el = await mount(html`<motion-theme-toggle system mode="light"></motion-theme-toggle>`)
    const btn = button(el)
    expect(btn.hasAttribute('role')).toBe(false)
    btn.click()
    await elementUpdated(el)
    expect(el.mode).toBe('dark')
    btn.click()
    await elementUpdated(el)
    expect(el.mode).toBe('system')
    expect(root.dataset.theme).toBe('dark')
    expect(btn.getAttribute('aria-label')).toBe('Theme: System')
    btn.click()
    await elementUpdated(el)
    expect(el.mode).toBe('light')
  })

  it('falls back from system when the option is not enabled', async () => {
    stubMedia({ dark: true })
    const el = await mount(html`<motion-theme-toggle mode="system"></motion-theme-toggle>`)
    expect(el.mode).toBe('dark')
  })

  it('permanent persists the choice and restores it on the next mount', async () => {
    const el = await mount(html`<motion-theme-toggle permanent></motion-theme-toggle>`)
    el.mode = 'dark'
    await elementUpdated(el)
    expect(localStorage.getItem('motion-theme')).toBe('dark')
    el.remove()
    delete root.dataset.theme
    const next = await mount(html`<motion-theme-toggle></motion-theme-toggle>`)
    expect(next.mode).toBe('dark')
    expect(next.permanent).toBe(true)
    expect(root.dataset.theme).toBe('dark')
  })

  it('remember checkbox toggles permanent and fires permanentcolorschemechange', async () => {
    const events: CustomEvent[] = []
    const record = (e: CustomEvent) => events.push(e)
    const el = await mount(
      html`<motion-theme-toggle
        remember="Remember"
        @permanentcolorschemechange=${record}
      ></motion-theme-toggle>`,
    )
    const box = shadow(el).querySelector<HTMLInputElement>('.remember input')!
    box.click()
    await elementUpdated(el)
    expect(el.permanent).toBe(true)
    expect(localStorage.getItem('motion-theme')).toBe('light')
    expect(events[events.length - 1]?.detail).toEqual({ permanent: true })
    box.click()
    await elementUpdated(el)
    expect(localStorage.getItem('motion-theme')).toBeNull()
    expect(events[events.length - 1]?.detail).toEqual({ permanent: false })
  })

  it('switches prefers-color-scheme stylesheets on and off', async () => {
    const dark = document.createElement('link')
    dark.rel = 'stylesheet'
    dark.media = '(prefers-color-scheme: dark)'
    const light = document.createElement('link')
    light.rel = 'stylesheet'
    light.media = '(prefers-color-scheme: light)'
    document.head.append(dark, light)
    const el = await mount(html`<motion-theme-toggle mode="dark"></motion-theme-toggle>`)
    expect(dark.media).toBe('all')
    expect(light.media).toBe('not all')
    el.mode = 'light'
    await elementUpdated(el)
    expect(dark.media).toBe('not all')
    expect(light.media).toBe('all')
    dark.remove()
    light.remove()
  })

  it('applies to a custom target instead of <html>', async () => {
    const scope = document.createElement('div')
    scope.id = 'scope'
    document.body.append(scope)
    await mount(html`<motion-theme-toggle target="#scope" mode="dark"></motion-theme-toggle>`)
    expect(scope.dataset.theme).toBe('dark')
    expect(root.dataset.theme).toBeUndefined()
    scope.remove()
  })

  it('does not overwrite a saved system choice when another toggle lacks system', async () => {
    localStorage.setItem('motion-theme', 'system')
    stubMedia({ dark: true })
    const wrap = (await fixture(
      html`<div>
        <motion-theme-toggle appearance="menu" system permanent></motion-theme-toggle>
        <motion-theme-toggle></motion-theme-toggle>
      </div>`,
    )) as HTMLElement
    const [nav, demo] = [...wrap.querySelectorAll('motion-theme-toggle')]
    await elementUpdated(nav)
    await elementUpdated(demo)
    expect(nav.mode).toBe('system')
    expect(demo.mode).toBe('dark')
    expect(localStorage.getItem('motion-theme')).toBe('system')
  })

  it('keeps storage separate per target', async () => {
    localStorage.setItem('motion-theme', 'dark')
    const scope = document.createElement('div')
    scope.id = 'card'
    document.body.append(scope)
    const card = await mount(
      html`<motion-theme-toggle target="#card" permanent mode="light"></motion-theme-toggle>`,
    )
    expect(card.mode).toBe('light')
    card.mode = 'dark'
    await elementUpdated(card)
    expect(localStorage.getItem('motion-theme:#card')).toBe('dark')
    card.mode = 'light'
    await elementUpdated(card)
    expect(localStorage.getItem('motion-theme:#card')).toBe('light')
    expect(localStorage.getItem('motion-theme')).toBe('dark')
    scope.remove()
  })

  it('changes the theme without a page wipe by default', async () => {
    const el = await mount(html`<motion-theme-toggle></motion-theme-toggle>`)
    button(el).click()
    await elementUpdated(el)
    expect(root.dataset.theme).toBe('dark')
    expect(animateViewMock).not.toHaveBeenCalled()
  })

  it('reveals with a circular view-transition wipe when wipe is set', async () => {
    const el = await mount(html`<motion-theme-toggle wipe></motion-theme-toggle>`)
    expect(animateViewMock).not.toHaveBeenCalled()
    button(el).click()
    await elementUpdated(el)
    expect(animateViewMock).toHaveBeenCalledOnce()
    expect(animateViewMock.mock.calls[0][1]).toMatchObject({ interrupt: 'immediate' })
    const [keyframes, options] = viewNew.mock.calls[0]
    expect(keyframes.clipPath[0]).toMatch(/^circle\(0px at /)
    expect(options).toMatchObject({ type: 'spring', bounce: 0 })
  })

  it('skips the wipe under reduced motion even when wipe is set', async () => {
    stubMedia({ reduce: true })
    const el = await mount(html`<motion-theme-toggle wipe></motion-theme-toggle>`)
    button(el).click()
    await elementUpdated(el)
    expect(root.dataset.theme).toBe('dark')
    expect(animateViewMock).not.toHaveBeenCalled()
  })

  it('toggle appearance renders a radio group with a legend', async () => {
    const el = await mount(
      html`<motion-theme-toggle appearance="toggle" legend="Theme" system></motion-theme-toggle>`,
    )
    const radios = shadow(el).querySelectorAll<HTMLInputElement>('input[type="radio"]')
    expect(shadow(el).querySelector('legend')!.textContent).toBe('Theme')
    expect(radios.length).toBe(3)
    radios[1].click()
    await elementUpdated(el)
    expect(el.mode).toBe('dark')
  })

  it('icon-only toggle hides labels visually but keeps them accessible', async () => {
    const el = await mount(
      html`<motion-theme-toggle appearance="toggle" icon-only system></motion-theme-toggle>`,
    )
    const segments = [...shadow(el).querySelectorAll<HTMLLabelElement>('.segment')]
    expect(segments.map((s) => s.title)).toEqual(['Light', 'Dark', 'System'])
    const label = segments[1].querySelector('span')!
    expect(label.className).toBe('visually-hidden')
    expect(label.textContent).toBe('Dark')
    expect(label.getBoundingClientRect().width).toBeLessThanOrEqual(1)
  })

  it('switch appearance ignores the system option', async () => {
    const el = await mount(
      html`<motion-theme-toggle appearance="switch" system mode="system"></motion-theme-toggle>`,
    )
    expect(el.mode).not.toBe('system')
    const track = button(el, '.track')
    expect(track.getAttribute('role')).toBe('switch')
    track.click()
    await elementUpdated(el)
    expect(el.mode).toBe('dark')
  })

  it('menu follows the menu button pattern', async () => {
    const el = await mount(
      html`<motion-theme-toggle appearance="menu" system></motion-theme-toggle>`,
    )
    const trigger = button(el, '.trigger')
    const panel = shadow(el).querySelector<HTMLElement>('.panel')!
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(panel.hidden).toBe(true)

    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await elementUpdated(el)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(panel.hidden).toBe(false)
    const items = [...shadow(el).querySelectorAll<HTMLElement>('[role="menuitemradio"]')]
    expect(items.length).toBe(3)
    expect(shadow(el).activeElement).toBe(items[2])

    items[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(shadow(el).activeElement).toBe(items[0])

    items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await elementUpdated(el)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(panel.hidden).toBe(true)
    expect(shadow(el).activeElement).toBe(trigger)

    trigger.click()
    await elementUpdated(el)
    items[1].click()
    await elementUpdated(el)
    expect(el.mode).toBe('dark')
    expect(items[1].getAttribute('aria-checked')).toBe('true')
    expect(panel.hidden).toBe(true)
  })

  it('closes the menu on an outside pointerdown', async () => {
    const el = await mount(html`<motion-theme-toggle appearance="menu"></motion-theme-toggle>`)
    button(el, '.trigger').click()
    await elementUpdated(el)
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }))
    await elementUpdated(el)
    expect(button(el, '.trigger').getAttribute('aria-expanded')).toBe('false')
  })

  it('keeps several toggles on the same target in sync', async () => {
    const wrap = (await fixture(
      html`<div>
        <motion-theme-toggle wipe></motion-theme-toggle>
        <motion-theme-toggle appearance="switch"></motion-theme-toggle>
      </div>`,
    )) as HTMLElement
    const [a, b] = [...wrap.querySelectorAll('motion-theme-toggle')]
    await elementUpdated(a)
    button(a).click()
    await elementUpdated(a)
    await elementUpdated(b)
    expect(b.mode).toBe('dark')
    expect(button(b, '.track').getAttribute('aria-checked')).toBe('true')
    expect(animateViewMock).toHaveBeenCalledOnce()
  })
})
