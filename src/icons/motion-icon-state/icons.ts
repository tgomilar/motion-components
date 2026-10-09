import { svg } from 'lit'
import type { SVGTemplateResult } from 'lit'
import type { IconStateName } from './motion-icon-state.types.js'

type Keyframes = Record<string, number | number[]>

/**
 * Offset of an undrawn `.dash` shape. The dash pattern is `1 2`, so an offset a little past 1
 * leaves no zero-length dash at the start of the path, which a round cap would paint as a dot.
 */
export const HIDDEN = 1.05

export interface IconStateDef {
  /** Shapes on a 24 px grid. `.dash` shapes are drawn in with `strokeDashoffset`. */
  shapes: SVGTemplateResult
  /** Per-part targets keyed by class name, for the inactive and active state. */
  off: Record<string, Keyframes>
  on: Record<string, Keyframes>
  /** Parts that spin while the icon is inactive. */
  spin?: string
}

export const ICONS: Record<IconStateName, IconStateDef> = {
  menu: {
    shapes: svg`<line class="top" x1="4" y1="6" x2="20" y2="6" />
      <line class="mid" x1="4" y1="12" x2="20" y2="12" />
      <line class="bot" x1="4" y1="18" x2="20" y2="18" />`,
    off: { top: { y: 0, rotate: 0 }, mid: { opacity: 1, scaleX: 1 }, bot: { y: 0, rotate: 0 } },
    on: { top: { y: 6, rotate: 45 }, mid: { opacity: 0, scaleX: 0 }, bot: { y: -6, rotate: -45 } },
  },
  play: {
    shapes: svg`<path class="tri" d="M7 4.5v15l12-7.5z" />
      <line class="bar1" x1="9" y1="5" x2="9" y2="19" />
      <line class="bar2" x1="15" y1="5" x2="15" y2="19" />`,
    off: {
      tri: { opacity: 1, scale: 1, rotate: 0 },
      bar1: { opacity: 0, scaleY: 0 },
      bar2: { opacity: 0, scaleY: 0 },
    },
    on: {
      tri: { opacity: 0, scale: 0.5, rotate: 90 },
      bar1: { opacity: 1, scaleY: 1 },
      bar2: { opacity: 1, scaleY: 1 },
    },
  },
  copy: {
    shapes: svg`<rect class="sheet" x="8" y="8" width="13" height="13" rx="2" />
      <path class="back" d="M4 15V5a1 1 0 0 1 1-1h10" />
      <path class="check dash" d="M5 12.5l4.5 4.5L19 7.5" pathLength="1" />`,
    off: {
      sheet: { opacity: 1, scale: 1 },
      back: { opacity: 1, scale: 1 },
      check: { strokeDashoffset: HIDDEN },
    },
    on: {
      sheet: { opacity: 0, scale: 0.7 },
      back: { opacity: 0, scale: 0.7 },
      check: { strokeDashoffset: 0 },
    },
  },
  plus: {
    shapes: svg`<line class="h" x1="5" y1="12" x2="19" y2="12" />
      <line class="v" x1="12" y1="5" x2="12" y2="19" />`,
    off: { v: { rotate: 0 } },
    on: { v: { rotate: 90 } },
  },
  chevron: {
    shapes: svg`<path class="c" d="M6 9l6 6 6-6" />`,
    off: { c: { rotate: 0 } },
    on: { c: { rotate: 180 } },
  },
  heart: {
    shapes: svg`<path
      class="h fill"
      d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
    />`,
    off: { h: { fillOpacity: 0, scale: 1 } },
    on: { h: { fillOpacity: 1, scale: [0.7, 1] } },
  },
  loading: {
    shapes: svg`<circle class="track" cx="12" cy="12" r="9" opacity="0.2" />
      <g class="arc"><circle cx="12" cy="12" r="9" stroke="none" /><path d="M21 12a9 9 0 0 0-9-9" /></g>
      <circle class="ring dash" cx="12" cy="12" r="9" pathLength="1" />
      <path class="check dash" d="M8 12.5l3 3 5-6" pathLength="1" />`,
    off: {
      arc: { opacity: 1 },
      ring: { strokeDashoffset: HIDDEN },
      check: { strokeDashoffset: HIDDEN },
    },
    on: { arc: { opacity: 0 }, ring: { strokeDashoffset: 0 }, check: { strokeDashoffset: 0 } },
    spin: 'arc',
  },
  eye: {
    shapes: svg`<path
        class="lid"
        d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"
      />
      <circle class="pupil" cx="12" cy="12" r="3" />
      <line class="slash dash" x1="3" y1="3" x2="21" y2="21" pathLength="1" />`,
    off: { pupil: { scale: 1 }, slash: { strokeDashoffset: HIDDEN } },
    on: { pupil: { scale: 0.7 }, slash: { strokeDashoffset: 0 } },
  },
}
