export type IconSlide = 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right'
export type IconMotion = 'pop' | 'bounce' | 'rotate' | 'wiggle' | 'pulse' | IconSlide
export type IconAnimation = 'draw' | IconMotion | `draw ${IconMotion}`
export type IconTrigger = 'hover' | 'click' | 'view' | 'mount' | 'loop'

export interface MotionIconProps {
  src: string
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
