import type { LoopProps } from '../utils/loop.js'

export interface MotionTypewriterProps extends LoopProps {
  interval: number
  delay: number
  hold: number
  loop: boolean
  cursor: boolean
}
