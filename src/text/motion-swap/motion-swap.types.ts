import type { LoopProps } from '../utils/loop.js'

export type TriggerMode = 'hover' | 'view'

export interface MotionSwapProps extends LoopProps {
  trigger: TriggerMode
  reverse: boolean
  interval: number
  duration: number
  bounce: number
  once: boolean
  delay: number
}
