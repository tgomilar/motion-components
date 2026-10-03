export type SparklineTrigger = 'view' | 'mount'

export interface MotionSparklineProps {
  values: string
  area: boolean
  trigger: SparklineTrigger
  duration: number
  bounce: number
  label: string
}
