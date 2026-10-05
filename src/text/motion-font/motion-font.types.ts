import type { LoopProps } from '../utils/loop.js'

export type FontTrigger = 'view' | 'hover' | 'scroll'

export interface MotionFontProps extends LoopProps {
  axis: string
  axes: string
  from: number
  to: number
  duration: number
  bounce: number
  delay: number
  trigger: FontTrigger
  once: boolean
}
