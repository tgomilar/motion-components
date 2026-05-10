export type TickerDirection = 'left' | 'right'

export interface MotionTickerProps {
  speed: number
  gap: number
  direction: TickerDirection
  pauseOnHover: boolean
  wave: boolean
  waveAmplitude: number
  waveLength: number
}
