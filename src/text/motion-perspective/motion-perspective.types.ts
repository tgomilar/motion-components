import type { LoopProps } from '../utils/loop.js'

export type VanishDirection = 'left' | 'right'

export interface MotionPerspectiveProps extends Pick<LoopProps, 'loop' | 'pauseOnHover'> {
  text?: string
  depth: number
  vanish: VanishDirection
  duration: number
}
