export type SparklineTrigger = 'view' | 'mount'

export interface MotionSparklineProps {
  values: string
  data: number[] | null
  area: boolean
  trigger: SparklineTrigger
  duration: number
  bounce: number
  label: string
}
