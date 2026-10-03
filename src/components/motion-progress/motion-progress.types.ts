export type ProgressPosition = 'top' | 'bottom'

export interface MotionProgressProps {
  position: ProgressPosition
  thickness: number
  target: string
  bounce: number
  duration: number
}
