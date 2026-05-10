export type BlurDirection = 'in' | 'out' | 'both'

export interface MotionBlurProps {
  direction: BlurDirection
  amount: number
  y: number
  once: boolean
}
