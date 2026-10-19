export type StaggerFrom = 'first' | 'last' | 'center'

export interface MotionStaggerProps {
  interval: number
  duration: number
  delay: number
  threshold: number
  y: number
  from: StaggerFrom
  once: boolean
}
