export type BlurDirection = 'in' | 'out' | 'both'

export interface MotionBlurProps {
  direction: BlurDirection
  intensity: number
  y: number
  once: boolean
}
