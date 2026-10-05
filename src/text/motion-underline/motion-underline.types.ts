import type { MarkProps } from '../utils/mark.types.js'

export type { MarkTrigger } from '../utils/mark.types.js'

export type UnderlineShape = 'line' | 'dashed' | 'dotted' | 'wave' | 'zigzag'

export interface MotionUnderlineProps extends MarkProps {
  shape: UnderlineShape
}
