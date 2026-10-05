import type { LoopProps } from '../utils/loop.js'

export type HeadlineBy = 'words' | 'chars' | 'lines'
export type HeadlineVariant = 'slide' | 'flip'

export interface MotionHeadlineProps extends LoopProps {
  by: HeadlineBy
  variant: HeadlineVariant
  interval: number
  duration: number
  delay: number
  threshold: number
  once: boolean
}
