export type SplitBy = 'words' | 'chars' | 'lines'

export interface MotionSplitProps {
  by: SplitBy
  interval: number
  duration: number
  y: number
  once: boolean
}
