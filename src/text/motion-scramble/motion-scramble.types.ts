export type ScrambleTrigger = 'view' | 'hover'

export interface MotionScrambleProps {
  interval: number
  delay: number
  iterations: number
  once: boolean
  trigger: ScrambleTrigger
}
