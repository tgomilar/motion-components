import { MotionIconState } from '../motion-icon-state/motion-icon-state.js'
import { defineElement } from '../../utils/define.js'

export type {
  IconStateName as StateIconName,
  IconStateChangeDetail as StateIconChangeDetail,
  MotionIconStateProps as MotionStateIconProps,
} from '../motion-icon-state/motion-icon-state.types.js'
export type { MotionChangeDetail } from '../../utils/events.js'

let warned = false

/**
 * The old name of `motion-icon-state`. It works the same way and logs a
 * one-time warning. It will be removed in 2.0, so switch to
 * `<motion-icon-state>` and `motion-components/motion-icon-state`.
 *
 * @deprecated Use `motion-icon-state`.
 * @element motion-state-icon
 */
export class MotionStateIcon extends MotionIconState {
  connectedCallback() {
    super.connectedCallback()
    if (warned) return
    warned = true
    console.warn(
      '<motion-state-icon> is now <motion-icon-state>. The old name still works and will be removed in 2.0.',
    )
  }
}

defineElement('motion-state-icon', MotionStateIcon)

declare global {
  interface HTMLElementTagNameMap {
    'motion-state-icon': MotionStateIcon
  }
}
