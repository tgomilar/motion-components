import type { MarkProps } from '../utils/mark.types.js'

export type { MarkTrigger } from '../utils/mark.types.js'

export type RingShape = 'ellipse' | 'box'

export interface MotionRingProps extends MarkProps {
  shape: RingShape
  padding: number
}
