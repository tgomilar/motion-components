export type CompareOrientation = 'horizontal' | 'vertical'

export interface MotionImageCompareProps {
  start: number
  orientation: CompareOrientation
  bounce: number
  duration: number
}
