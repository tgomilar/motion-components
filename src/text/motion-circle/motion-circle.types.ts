export type CircleDirection = 'cw' | 'ccw'

export interface MotionCircleProps {
  text?: string
  radius: number
  speed: number
  direction: CircleDirection
  upright: boolean
  pauseOnHover: boolean
}
