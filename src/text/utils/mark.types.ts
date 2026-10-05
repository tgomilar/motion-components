import type { LoopProps } from './loop.js'

export type MarkTrigger = 'view' | 'hover' | 'mount'

export interface MarkProps extends LoopProps {
  trigger: MarkTrigger
  duration: number
  delay: number
  bounce: number
  once: boolean
  threshold: number
}
