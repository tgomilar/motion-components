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

export const storageKey = (target: string) => {
  const selector = target.trim()
  return !selector || selector === 'html' || selector === ':root'
    ? STORAGE_KEY
    : `${STORAGE_KEY}:${selector}`
}

export function readStored(key: string): ThemeMode | null {
  try {
    const value = localStorage.getItem(key)
    return isMode(value) ? value : null
  } catch {
    return null
  }
}

export function writeStored(key: string, mode: ThemeMode | null) {
  try {
    if (mode) localStorage.setItem(key, mode)
    else localStorage.removeItem(key)
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
