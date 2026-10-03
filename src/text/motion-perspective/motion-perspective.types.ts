export type VanishDirection = 'left' | 'right'

export interface MotionPerspectiveProps {
  text?: string
  depth: number
  vanish: VanishDirection
  oscillate: boolean
  duration: number
  pauseOnHover: boolean
}
