export type CircleDirection = 'cw' | 'ccw'

export interface MotionCircleProps {
  text?: string
  radius: number
  duration: number
  direction: CircleDirection
  upright: boolean
  pauseOnHover: boolean
}
