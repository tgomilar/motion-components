export type GravityTrigger = 'mount' | 'view'

export interface MotionGravityProps {
  text?: string
  height: number
  interval: number
  duration: number
  bounce: number
  delay: number
  threshold: number
  trigger: GravityTrigger
}
