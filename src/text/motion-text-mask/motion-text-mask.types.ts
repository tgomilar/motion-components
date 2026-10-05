import type { LoopProps } from '../utils/loop.js'

export interface MotionTextMaskProps extends LoopProps {
  duration: number
  delay: number
  threshold: number
  once: boolean
}
