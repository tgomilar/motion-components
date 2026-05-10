import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { animate } from 'motion'
import type { MotionImageCompareProps, CompareOrientation } from './motion-image-compare.types.js'

export type { MotionImageCompareProps, CompareOrientation } from './motion-image-compare.types.js'

/**
 * Before/after image comparison slider with a draggable, spring-damped handle.
 * Slot two children with `slot="before"` and `slot="after"`. Keyboard-accessible:
 * focus the handle and use arrow keys to nudge the split.
 *
 * @element motion-image-compare
 *
 * @slot before - The left/top image (visible behind the clip).
 * @slot after  - The right/bottom image (revealed by dragging).
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
      outline: 2px solid var(--color-accent, #2563eb);
      outline-offset: 3px;
    }
  `

  private dragging = false
  private knob: HTMLElement | null = null

  private get reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  firstUpdated() {
    this.pos = this.clamp(this.start)
    this.apply()
    this.knob = this.renderRoot.querySelector('.knob')
    this.addEventListener('pointerdown', this.onDown)
    window.addEventListener('pointermove', this.onMove)
    window.addEventListener('pointerup', this.onUp)
    this.knob?.addEventListener('keydown', this.onKey)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener('pointerdown', this.onDown)
    window.removeEventListener('pointermove', this.onMove)
    window.removeEventListener('pointerup', this.onUp)
    this.knob?.removeEventListener('keydown', this.onKey)
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('orientation') || changed.has('start')) {
      if (changed.has('start')) this.pos = this.clamp(this.start)
      this.apply()
    }
  }

  private clamp(v: number) {
    return Math.max(0, Math.min(100, v))
  }

  private onDown = (e: PointerEvent) => {
    this.dragging = true
    this.setPointerCapture?.(e.pointerId)
    this.spring(this.fromEvent(e))
  }

  private onMove = (e: PointerEvent) => {
    if (!this.dragging) return
    this.pos = this.fromEvent(e)
    this.apply()
  }

  private onUp = () => {
    this.dragging = false
  }

  private onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2
    let next = this.pos
    if (this.orientation === 'horizontal') {
      if (e.key === 'ArrowLeft') next -= step
      else if (e.key === 'ArrowRight') next += step
      else return
    } else {
      if (e.key === 'ArrowUp') next -= step
      else if (e.key === 'ArrowDown') next += step
      else return
    }
    e.preventDefault()
    this.spring(this.clamp(next))
  }

  private fromEvent(e: PointerEvent): number {
    const r = this.getBoundingClientRect()
    const ratio =
      this.orientation === 'horizontal'
        ? (e.clientX - r.left) / r.width
        : (e.clientY - r.top) / r.height
    return this.clamp(ratio * 100)
  }

  private spring(target: number) {
    if (this.reduced) {
      this.pos = target
      this.apply()
      return
    }
    const obj = { v: this.pos }
    animate(
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
      if (this.orientation === 'horizontal') handle.style.left = `${p}%`
      else handle.style.top = `${p}%`
    }
  }

  render() {
    return html`
      <div class="pane before"><slot name="before"></slot></div>
      <div class="pane after"><slot name="after"></slot></div>
      <div class="handle" aria-hidden="true">
        <div
          class="knob"
          role="slider"
          tabindex="0"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow=${Math.round(this.pos)}
          aria-orientation=${this.orientation}
        >
          ⇆
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
