import type { LoopProps } from '../utils/loop.js'

export type SplitBy = 'words' | 'chars' | 'lines'

export interface MotionSplitProps extends LoopProps {
  by: SplitBy
  interval: number
  duration: number
  y: number
  once: boolean
}
