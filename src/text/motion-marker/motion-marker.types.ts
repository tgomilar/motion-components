import type { MarkProps } from '../utils/mark.types.js'

export type { MarkTrigger } from '../utils/mark.types.js'

export type MarkerShape = 'line' | 'wave'

export interface MotionMarkerProps extends MarkProps {
  shape: MarkerShape
}
