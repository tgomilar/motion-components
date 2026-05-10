export type GlitchTrigger = 'hover' | 'auto' | 'loop'

export interface MotionGlitchProps {
  intensity?: number
  trigger?: GlitchTrigger
  interval?: number
}
