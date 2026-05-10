export type StaggerFrom = 'first' | 'last' | 'center'

export interface MotionStaggerProps {
  interval: number
  duration: number
  y: number
  from: StaggerFrom
  once: boolean
}
