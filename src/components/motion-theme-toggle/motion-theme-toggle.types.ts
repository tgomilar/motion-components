export type ThemeMode = 'light' | 'dark' | 'system'
export type ColorScheme = 'light' | 'dark'
export type ThemeAppearance = 'icon' | 'toggle' | 'switch' | 'menu'

export interface ColorSchemeChangeDetail {
  colorScheme: ColorScheme
  mode: ThemeMode
}

export interface PermanentColorSchemeChangeDetail {
  permanent: boolean
}

export interface MotionThemeToggleProps {
  mode: ThemeMode
  appearance: ThemeAppearance
  system: boolean
  permanent: boolean
  legend: string
  light: string
  dark: string
  systemLabel: string
  remember: string
  target: string
  wipe: boolean
  iconOnly: boolean
  duration: number
  bounce: number
}
