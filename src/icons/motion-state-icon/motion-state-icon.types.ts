export type StateIconName =
  | 'menu'
  | 'play'
  | 'copy'
  | 'plus'
  | 'chevron'
  | 'heart'
  | 'loading'
  | 'eye'

export interface StateIconChangeDetail {
  active: boolean
}

export interface MotionStateIconProps {
  name: StateIconName
  active: boolean
  toggle: boolean
  label: string
  duration: number
  bounce: number
}
