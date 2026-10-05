import type { LoopProps } from '../utils/loop.js'

export interface MotionCounterProps extends LoopProps {
  from: number
  to: number
  duration: number
  decimals: number
  prefix: string
  suffix: string
  once: boolean
}
