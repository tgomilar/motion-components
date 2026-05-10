export type HeadlineBy = 'words' | 'chars' | 'lines'
export type HeadlineVariant = 'slide' | 'flip'

export interface MotionHeadlineProps {
  by?: HeadlineBy
  variant?: HeadlineVariant
  interval?: number
  duration?: number
  delay?: number
  threshold?: number
  once?: boolean
}
