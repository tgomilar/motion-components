export type FlipTrigger = 'hover' | 'click'
export type FlipAxis = 'x' | 'y'

export interface MotionFlipCardProps {
  trigger: FlipTrigger
  axis: FlipAxis
  duration: number
  bounce: number
  perspective: number
}
