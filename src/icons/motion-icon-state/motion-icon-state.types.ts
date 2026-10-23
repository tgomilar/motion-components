export type IconStateName =
  | 'menu'
  | 'play'
  | 'copy'
  | 'plus'
  | 'chevron'
  | 'heart'
  | 'loading'
  | 'eye'
  | 'equalizer'

export interface IconStateChangeDetail {
  active: boolean
}

export interface MotionIconStateProps {
  name: IconStateName
  active: boolean
  toggle: boolean
  label: string
  duration: number
  bounce: number
}
