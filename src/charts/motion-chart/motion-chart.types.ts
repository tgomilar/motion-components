import type { ChartData } from '../utils/chart-data.js'

export type { ChartData, ChartSeries } from '../utils/chart-data.js'

export type ChartType = 'bar' | 'line'
export type ChartTrigger = 'view' | 'mount'

export interface MotionChartProps {
  type: ChartType
  values: string
  labels: string
  series: string
  data: ChartData | null
  min: number
  max: number
  format: string
  trigger: ChartTrigger
  duration: number
  bounce: number
  interval: number
  tooltip: boolean
  legend: boolean
  label: string
}
