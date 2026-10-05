import type { LoopProps } from '../utils/loop.js'

export type ScrambleTrigger = 'view' | 'hover'

export interface MotionScrambleProps extends LoopProps {
  interval: number
  delay: number
  iterations: number
  once: boolean
  trigger: ScrambleTrigger
}
