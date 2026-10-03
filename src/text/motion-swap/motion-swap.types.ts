export type TriggerMode = 'hover' | 'view'

export interface MotionSwapProps {
  trigger: TriggerMode
  reverse: boolean
  interval: number
  duration: number
  bounce: number
  once: boolean
  delay: number
}
