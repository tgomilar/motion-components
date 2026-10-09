import type { SliderChangeDetail } from '../components/motion-slider/motion-slider.types.js'
import type { GalleryIndexDetail } from '../components/motion-gallery/motion-gallery.types.js'
import type { FlipCardChangeDetail } from '../components/motion-flip-card/motion-flip-card.types.js'
import type { ImageCompareChangeDetail } from '../components/motion-image-compare/motion-image-compare.types.js'
import type { IconStateChangeDetail } from '../icons/motion-icon-state/motion-icon-state.types.js'

/**
 * Detail of a `motion-change` event. The event bubbles, so a listener on an
 * element that contains other components checks `event.target` first.
 */
export type MotionChangeDetail =
  | SliderChangeDetail
  | GalleryIndexDetail
  | FlipCardChangeDetail
  | ImageCompareChangeDetail
  | IconStateChangeDetail

declare global {
  interface HTMLElementEventMap {
    'motion-start': Event
    'motion-finish': Event
    'motion-cancel': Event
    'motion-open': CustomEvent<GalleryIndexDetail | null>
    'motion-close': Event
    'motion-change': CustomEvent<MotionChangeDetail>
  }
}
