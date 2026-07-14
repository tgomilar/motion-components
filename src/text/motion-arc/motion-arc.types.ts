export type ArcAlign = 'top' | 'bottom'
export type ArcDirection = 'cw' | 'ccw'

export interface MotionArcProps {
  text?: string
  radius: number
  arc: number
  align: ArcAlign
  speed: number
  direction: ArcDirection
  upright: boolean
  pauseOnHover: boolean
}
