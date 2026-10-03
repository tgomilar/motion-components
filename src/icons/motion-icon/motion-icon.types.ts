export type IconAnimation = 'draw' | 'pop' | 'bounce' | 'rotate' | 'wiggle' | 'pulse'
export type IconTrigger = 'hover' | 'click' | 'view' | 'mount' | 'loop'

export interface MotionIconProps {
  icon: string
  animation: IconAnimation
  trigger: IconTrigger
  duration: number
  bounce: number
  delay: number
  interval: number
  once: boolean
  label: string
}
