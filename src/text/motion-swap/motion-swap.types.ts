import type { AnimationOptions, SpringOptions } from 'motion'

export type TriggerMode = 'hover' | 'reveal'

export interface MotionSwapProps {
  trigger: TriggerMode
  reverse: boolean
  staggerDuration: number
  transition: AnimationOptions | SpringOptions
  once: boolean
  delay: number
}
