export type VanishDirection = 'left' | 'right'

export interface MotionPerspectiveProps {
  text?: string
  depth: number
  vanish: VanishDirection
  oscillate: boolean
  speed: number
  pauseOnHover: boolean
}
