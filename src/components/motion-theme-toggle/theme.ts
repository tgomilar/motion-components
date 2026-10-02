import type { ColorScheme, ThemeMode } from './motion-theme-toggle.types.js'

export const STORAGE_KEY = 'motion-theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'
const LINK_SELECTOR =
  'link[rel~="stylesheet"][media*="prefers-color-scheme"], link[data-motion-theme-media]'

export const darkQuery = () => window.matchMedia(DARK_QUERY)

export const osScheme = (): ColorScheme => (darkQuery().matches ? 'dark' : 'light')

export const isMode = (value: unknown): value is ThemeMode =>
  value === 'light' || value === 'dark' || value === 'system'

export const resolveScheme = (mode: ThemeMode): ColorScheme =>
  mode === 'system' ? osScheme() : mode

export function readStored(): ThemeMode | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isMode(value) ? value : null
  } catch {
    return null
  }
}

export function writeStored(mode: ThemeMode | null) {
  try {
    if (mode) localStorage.setItem(STORAGE_KEY, mode)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    return
  }
}

export function resolveTarget(selector: string): HTMLElement {
  return (selector && document.querySelector<HTMLElement>(selector)) || document.documentElement
}

export const appliedScheme = (target: HTMLElement): ColorScheme | null => {
  const value = target.dataset.theme
  return value === 'light' || value === 'dark' ? value : null
}

export function applyScheme(target: HTMLElement, scheme: ColorScheme) {
  target.dataset.theme = scheme
  target.style.colorScheme = scheme
  if (target === document.documentElement) syncStylesheets(scheme)
}

function syncStylesheets(scheme: ColorScheme) {
  for (const link of document.querySelectorAll<HTMLLinkElement>(LINK_SELECTOR)) {
    const original = (link.dataset.motionThemeMedia ??= link.media)
    const wants = /prefers-color-scheme:\s*dark/.test(original) ? 'dark' : 'light'
    link.media = wants === scheme ? 'all' : 'not all'
  }
}
