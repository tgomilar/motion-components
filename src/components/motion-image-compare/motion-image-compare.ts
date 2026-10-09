import { LitElement, html, css } from 'lit'
import { property, state } from 'lit/decorators.js'
import { animate } from 'motion'
import type { AnimationPlaybackControls } from 'motion'
import type { MotionImageCompareProps, CompareOrientation } from './motion-image-compare.types.js'
import { customElement } from '../../utils/define.js'

export type {
  MotionImageCompareProps,
  CompareOrientation,
  ImageCompareChangeDetail,
} from './motion-image-compare.types.js'
export type { MotionChangeDetail } from '../../utils/events.js'

/**
 * Before/after image comparison slider with a draggable, spring-damped handle.
 * Slot two children with `slot="before"` and `slot="after"`. Keyboard-accessible:
 * focus the handle and use arrow keys to nudge the split.
 *
 * **Use it for:** before and after views of the same scene, such as a photo
 * edit or a redesign, with two images of the same size.
 *
 * **Avoid it for:** more than two images, or two images with different
 * framing. For a set of images, use `motion-gallery` or `motion-slider`.
 *
 * **Accessibility:** the round knob takes keyboard focus. The arrow keys move
 * the split by 2% (Left and Right, or Up and Down when
 * `orientation="vertical"`), and Shift with an arrow key moves it by 10%.
 * Home and End move it to 0% and 100%. The knob has `role="slider"`, the
 * label "Image comparison" and a value from 0 to 100, so screen readers
 * announce it. Write `alt` text that says which image is before and which is
 * after.
 *
 * **Reduced motion:** a click or a key press moves the split at once, with
 * no spring. Dragging follows the pointer directly, as it always does.
 *
 * **Common mistakes:** leaving the element without a size; both images are
 * positioned on top of each other, so it has no height of its own. Set a CSS
 * height or aspect ratio on `motion-image-compare`. On touch screens a swipe
 * that starts on it moves the split and does not scroll the page, so leave
 * room around it on phones.
 *
 * @element motion-image-compare
 *
 * @slot before - The left/top image (visible behind the clip).
 * @slot after  - The right/bottom image (revealed by dragging).
 *
 * @fires motion-change - When a drag, click or key moves the split. `detail: { position }`, the percentage it moves to.
 *
 * @cssprop [--mc-color-accent=#2563eb] - Color of the keyboard focus ring on the knob.
 *
 * @example
 * ```html
 * <motion-image-compare start="50">
 *   <img slot="before" src="before.jpg" alt="Before" />
 *   <img slot="after"  src="after.jpg"  alt="After"  />
 * </motion-image-compare>
 * ```
 */
@customElement('motion-image-compare')
export class MotionImageCompare extends LitElement implements MotionImageCompareProps {
  /** Initial split position as a percentage (0–100). */
  @property({ type: Number, reflect: true }) start = 50
  /** Drag axis. */
  @property({ type: String, reflect: true }) orientation: CompareOrientation = 'horizontal'
  /** Spring bounciness of the snap-to-cursor animation. */
  @property({ type: Number }) bounce = 0.25
  /** Spring duration of the snap-to-cursor animation, in seconds. */
  @property({ type: Number }) duration = 0.45

  @state() private pos = 50

  static styles = css`
    :host {
      display: block;
      position: relative;
      overflow: hidden;
      touch-action: none;
      -webkit-user-select: none;
      user-select: none;
      cursor: ew-resize;
      isolation: isolate;
    }
    :host([orientation='vertical']) {
      cursor: ns-resize;
    }
    .pane {
      position: absolute;
      inset: 0;
    }
    .after {
      will-change: clip-path;
    }
    ::slotted(*) {
      -webkit-user-select: none;
      user-select: none;
      -webkit-user-drag: none;
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      pointer-events: none;
    }
    .handle {
      position: absolute;
      background: white;
      box-shadow: 0 0 12px rgba(0, 0, 0, 0.4);
      will-change: transform;
      pointer-events: none;
      top: 0;
      bottom: 0;
      width: 2px;
      left: 0;
      transform: translateX(-1px);
    }
    :host([orientation='vertical']) .handle {
      top: 0;
      left: 0;
      right: 0;
      width: auto;
      height: 2px;
      bottom: auto;
      transform: translateY(-1px);
    }
    .knob {
      position: absolute;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: white;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #333;
      font-size: 14px;
      font-weight: 700;
      cursor: inherit;
      pointer-events: auto;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
    .knob:focus-visible {
      outline: 2px solid var(--mc-color-accent, #2563eb);
      outline-offset: 3px;
    }
  `

  private dragging = false
  private goal: number | null = null
  private motion: AnimationPlaybackControls | null = null

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  connectedCallback() {
    super.connectedCallback()
    this.addEventListener('pointerdown', this.onDown)
    this.addEventListener('pointermove', this.onMove)
    this.addEventListener('pointerup', this.onUp)
    this.addEventListener('pointercancel', this.onUp)
    this.addEventListener('lostpointercapture', this.onUp)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener('pointerdown', this.onDown)
    this.removeEventListener('pointermove', this.onMove)
    this.removeEventListener('pointerup', this.onUp)
    this.removeEventListener('pointercancel', this.onUp)
    this.removeEventListener('lostpointercapture', this.onUp)
    this.stop()
  }

  firstUpdated() {
    this.pos = this.goal ?? this.clamp(this.start)
    this.goal = null
    this.apply()
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('orientation') || changed.has('start')) {
      if (changed.has('start') && changed.get('start') !== undefined) {
        this.stop()
        this.pos = this.clamp(this.start)
      }
      this.apply()
    }
  }

  /**
   * Split position as a percentage (0–100), where the split is going. Setting it springs
   * the split there without firing `motion-change`; before the first render it sets the
   * position the split starts at.
   */
  get position(): number {
    return this.goal ?? this.pos
  }

  set position(value: number) {
    const target = this.clamp(Number(value) || 0)
    if (!this.hasUpdated) {
      this.goal = target
      return
    }
    this.spring(target)
  }

  private clamp(v: number) {
    return Math.max(0, Math.min(100, v))
  }

  private onDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    this.dragging = true
    this.setPointerCapture(e.pointerId)
    this.moveTo(this.fromEvent(e), true)
  }

  private onMove = (e: PointerEvent) => {
    if (!this.dragging) return
    this.moveTo(this.fromEvent(e), false)
  }

  private onUp = () => {
    this.dragging = false
  }

  private onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2
    let next = this.pos
    if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = 100
    else if (this.orientation === 'horizontal') {
      if (e.key === 'ArrowLeft') next -= step
      else if (e.key === 'ArrowRight') next += step
      else return
    } else {
      if (e.key === 'ArrowUp') next -= step
      else if (e.key === 'ArrowDown') next += step
      else return
    }
    e.preventDefault()
    this.moveTo(this.clamp(next), true)
  }

  private moveTo(target: number, spring: boolean) {
    if (target === this.position) return
    if (spring) this.spring(target)
    else {
      this.stop()
      this.pos = target
      this.apply()
    }
    this.dispatchEvent(
      new CustomEvent('motion-change', {
        detail: { position: target },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private fromEvent(e: PointerEvent): number {
    const r = this.getBoundingClientRect()
    const ratio =
      this.orientation === 'horizontal'
        ? (e.clientX - r.left) / r.width
        : (e.clientY - r.top) / r.height
    return this.clamp(ratio * 100)
  }

  private stop() {
    this.motion?.stop()
    this.motion = null
    this.goal = null
  }

  private spring(target: number) {
    this.stop()
    if (this.reduced) {
      this.pos = target
      this.apply()
      return
    }
    const obj = { v: this.pos }
    this.goal = target
    this.motion = animate(
      obj,
      { v: target },
      {
        type: 'spring',
        bounce: this.bounce,
        duration: this.duration,
        onUpdate: (latest: number) => {
          this.pos = latest
          this.apply()
        },
      },
    )
  }

  private apply() {
    const after = this.renderRoot.querySelector<HTMLElement>('.after')
    const handle = this.renderRoot.querySelector<HTMLElement>('.handle')
    const p = this.pos
    if (after) {
      after.style.clipPath =
        this.orientation === 'horizontal' ? `inset(0 0 0 ${p}%)` : `inset(${p}% 0 0 0)`
    }
    if (handle) {
      const horizontal = this.orientation === 'horizontal'
      handle.style.left = horizontal ? `${p}%` : ''
      handle.style.top = horizontal ? '' : `${p}%`
    }
  }

  render() {
    return html`
      <div class="pane before"><slot name="before"></slot></div>
      <div class="pane after"><slot name="after"></slot></div>
      <div class="handle">
        <div
          class="knob"
          role="slider"
          tabindex="0"
          aria-label="Image comparison"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow=${Math.round(this.pos)}
          aria-orientation=${this.orientation}
          @keydown=${this.onKey}
        >
          <span aria-hidden="true">⇆</span>
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-image-compare': MotionImageCompare
  }
}
