export type ProgressPosition = 'top' | 'bottom'

export interface MotionProgressProps {
  position: ProgressPosition
  color: string
  thickness: number
  target: string
  bounce: number
  duration: number
}
