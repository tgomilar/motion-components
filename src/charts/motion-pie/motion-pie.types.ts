export type PieTrigger = 'view' | 'mount'

export interface PieData {
  labels: string[]
  values: number[]
}

export interface MotionPieProps {
  values: string
  labels: string
  data: PieData | null
  donut: boolean
  format: string
  totalLabel: string
  trigger: PieTrigger
  duration: number
  bounce: number
  tooltip: boolean
  legend: boolean
  label: string
}
