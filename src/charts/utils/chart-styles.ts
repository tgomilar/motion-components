import { css } from 'lit'

/** Series color `i` (zero-based): the `--chart-N` override, else the palette step for the current color scheme. */
export const seriesColor = (i: number) => `var(--chart-${i + 1}, var(--_c${i + 1}))`

/** Palette, legend, plot, tooltip and screen-reader styles shared by the chart components. */
export const chartStyles = css`
  :host {
    --_c1: light-dark(#2a78d6, #3987e5);
    --_c2: light-dark(#eb6834, #d95926);
    --_c3: light-dark(#1baf7a, #199e70);
    --_c4: light-dark(#eda100, #c98500);
    --_c5: light-dark(#e87ba4, #d55181);
    --_c6: light-dark(#008300, #008300);
    --_c7: light-dark(#4a3aa7, #9085e9);
    --_c8: light-dark(#e34948, #e66767);
    --_muted: color-mix(in srgb, currentColor 62%, transparent);
    --_grid: color-mix(in srgb, currentColor 12%, transparent);
    display: block;
    height: var(--chart-height, 16rem);
  }
  .frame {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 1rem;
    margin-bottom: 0.75rem;
    font-size: 0.8em;
  }
  .key {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .swatch {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    background: var(--c);
  }
  .plot {
    position: relative;
    flex: 1;
    min-height: 0;
    outline: none;
    border-radius: 6px;
  }
  .plot:focus-visible {
    box-shadow: 0 0 0 2px currentColor;
  }
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .tip {
    position: absolute;
    top: 0;
    left: 0;
    min-width: 6rem;
    padding: 0.5rem 0.65rem;
    border-radius: 8px;
    background: var(--chart-surface, Canvas);
    box-shadow:
      0 0 0 1px var(--_grid),
      0 6px 20px rgb(0 0 0 / 0.12);
    font-size: 0.8em;
    pointer-events: none;
    opacity: 0;
    white-space: nowrap;
  }
  .tip-label {
    color: var(--_muted);
    margin-bottom: 0.25rem;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }
  .row i {
    width: 12px;
    height: 2px;
    border-radius: 1px;
    background: var(--c);
  }
  .row span {
    color: var(--_muted);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
`
