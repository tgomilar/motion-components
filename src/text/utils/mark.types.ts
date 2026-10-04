export type MarkTrigger = 'view' | 'hover' | 'mount'

export interface MarkProps {
  trigger: MarkTrigger
  duration: number
  delay: number
  bounce: number
  once: boolean
  threshold: number
}
