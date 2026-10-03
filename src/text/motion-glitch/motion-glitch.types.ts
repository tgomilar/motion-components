export type GlitchTrigger = 'hover' | 'mount' | 'loop'

export interface MotionGlitchProps {
  intensity: number
  trigger: GlitchTrigger
  interval: number
}
