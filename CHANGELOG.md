# Changelog

## 1.3.0 — 2026-10-09

### Breaking changes

- `motion-icon-state` (formerly `motion-state-icon`): `--mc-icon-accent` is removed. Use `--mc-icon-color-active`, which colors the whole icon in its second state. The second state now takes the line color by default, instead of a red heart and green checks; set `--mc-icon-color-active` to keep a color, for example `--mc-icon-color-active: #e11d48` on the heart.

### Fixed

- `motion-strike`: the line was drawn under the text. It is now drawn in front, one segment per wrapped line.
- `motion-arc`: `align="top"` put the text on the left of the circle and `align="bottom"` on the right. Top now arcs over the top, and bottom arcs along the bottom, reading left to right with upright letters.
- `motion-image-compare`: while dragging, the divider snapped back toward the point where the drag started. It now follows the pointer. Only the main mouse button drags, a cancelled pointer ends the drag, and changing the orientation clears the old handle position.
- `motion-image-compare`: in Safari, dragging selected the images or dragged them out of the page.
- `motion-dialog`: the backdrop blur was cut off inside an element with `backdrop-filter`, such as a sticky header. The blur is now on `dialog::backdrop`, which is drawn in the top layer. In Safari before 17.4 and Chrome before 122, the backdrop appears without a fade and uses the default color and blur.
- `motion-code`: with `typing-loop="false"`, the full code showed before the block scrolled into view. The block now stays empty until then. Under reduced motion the code still shows at once.
- `motion-code`: in blocks narrower than 30rem the code and padding are smaller, and iOS Safari no longer enlarges the text.
- `motion-code-inline`: with `copy` and without `copy-visible`, the hidden copy button left a gap in the text. The button now appears just after the code on hover or focus, without taking space.
- `motion-gravity`, `motion-perspective`, `motion-curve` and `motion-text-mask`: the plain text flashed before the component loaded, then blinked or jumped. They are now hidden until they are defined, like the other text components.
- `pause()` and `pauseAll()` now hold. On `motion-circle`, `motion-curve`, `motion-arc`, `motion-perspective`, `motion-liquid` and `motion-ticker`, moving the pointer off a paused effect started it again. Leaving now only lifts a pause that the hover made.
- `motion-liquid`: the text kept flowing after `cancel()` or `finish()`. It now stops and rests.
- `motion-glitch`: with `trigger="hover"` or `"mount"`, `play()` started the endless loop. It now plays one burst as a normal run, with events, and `pause()`, `finish()` and `cancel()` act on it.
- `motion-icon`: with `trigger="loop"`, the loop came back after `finish()` and slipped past `pauseAll()` between cycles. The loop is now one run. A hover or click that interrupts a run fires `motion-cancel`, and starting again after a finished run no longer does.
- `motion-underline`, `motion-marker`, `motion-strike` and `motion-ring`: a loop now erases from its start, so the mark leaves at its end, and no dot stays behind at the end of the stroke. `motion-ring` drew a gap in the ellipse while it was erased.
- `motion-underline`, `motion-marker`, `motion-strike` and `motion-ring`: hover drawing now runs through playback, so it fires events and `pause()`, `finish()` and `cancel()` act on it.
- `motion-ticker`: `finish()` and `cancel()` froze the ticker where it was, like `pause()`. They now line the items up at the start.
- `motion-chart`: line charts left an empty gap at both ends of the plot. They now run edge to edge, and the first and last labels sit inside the plot. The grid line at the top of a new scale popped in at the end of the change; grid lines now fade between the old and new scale.
- `motion-countdown`: with `roll`, the digits slid out of their windows when the size changed.
- `motion-countdown`: it now counts again when `to` is set to a future time after it finished.
- `motion-slider`: `goTo()` threw when it was called before the slider was built. It now sets the slide the slider starts on. The documented unit of `initialVelocity` is px/s.
- `motion-gallery`: after the gallery was moved in the page, its items no longer opened the lightbox.
- `motion-progress`: under reduced motion, `playState` read `'finished'` while the bar followed scrolling. It now reads `'running'`.
- `motion-blur` and `motion-font`: `replay()` now cancels and plays again, as on the other components.
- `motion-code`: `setCode()` interrupted a typing run without firing `motion-cancel`.
- `motion-icon-state`: a dot showed at the start of an undrawn line, such as the check of `copy` and `loading` or the slash of `eye`. Undrawn lines are now fully hidden.
- `motion-image-compare`: pressing an arrow key again while the split was still moving stepped from where it was, not from where it was heading, so quick presses moved it less than the step.

### Changed

- `motion-state-icon` is renamed to `motion-icon-state`, so both icon components start with `motion-icon`. Import `motion-components/motion-icon-state` and use `<motion-icon-state>`; the class is `MotionIconState` and the types are `IconStateName` and `IconStateChangeDetail`. The old tag, import, class and type names still work, log a one-time warning, and will be removed in 2.0.
- `motion-code-inline`: the copy icon is a `motion-icon-state` that morphs into a check after copying, and it now scales with the text instead of staying 13px. `--mc-icon-color-active` sets the color of the check.
- `motion-perspective`: the default `duration` is now `3` seconds instead of `0.667`, because the old cycle was too fast for large text. Set `duration="0.667"` to keep the faster speed.
- `motion-icon`: hover, click and loop runs start from the icon's current position instead of resetting it, so hovering again never makes the icon jump. `wiggle` and `pulse` are springs instead of keyframes. Icons inside a `summary` also react to hover on it.
- `motion-blur`: under reduced motion it now fires `motion-start` and `motion-finish`, and `playState` reads `'finished'`.
- `pauseAll()` now also disables `motion-stretch` and holds the `motion-icon-state` loading spinner.

### Added

- `motion-icon`: `slide-up`, `slide-down`, `slide-left` and `slide-right` animations. On hover, the icon stays moved while the pointer is over it and springs back when the pointer leaves.
- `motion-code`: highlighting for shell code, in `.sh`, `.bash` and `.zsh` files and with `code-lang="sh"`: prompts, commands, flags, strings, variables, pipes and comments.
- `motion-underline`, `motion-marker`, `motion-strike` and `motion-ring`: `sweep()` erases the drawn mark from its start, then draws it in again.
- `motion-gallery`: `open(index)`, `close()`, `next()`, `prev()` and `index`, and `motion-open`, `motion-change` and `motion-close` events.
- `motion-slider`: `next()`, `prev()` and `index`.
- `motion-flip-card`: a `flipped` property and attribute, a `motion-change` event with `{ flipped }`, and `aria-pressed` with `trigger="click"`.
- `motion-icon-state`: `flip()` switches `active` and fires `motion-change`.
- `motion-dialog`: a `motion-open` event.
- `motion-image-compare`: a `position` property and a `motion-change` event with `{ position }`.
- `motion-sparkline`: `data` takes an array of numbers.
- `motion-chart`: `animate-scale="false"` switches the scale at once when the data changes.
- `motion-code`: a `code` property.
- `motion-stretch`: a `disabled` attribute.
- TypeScript: the `motion-*` events are typed on `addEventListener`, and the detail types (`MotionChangeDetail`, `SliderChangeDetail`, `GalleryIndexDetail`, `FlipCardChangeDetail`, `ImageCompareChangeDetail` and `StateIconChangeDetail`) are exported.
- `motion-icon-state`: `--mc-icon-color-active` colors any icon in its second state, such as the close cross of `menu`, the filled heart or the copy check.
- `motion-gravity`: `trigger="view"` drops the letters the first time half of the text scrolls into view. The default, `"mount"`, plays as soon as it renders.

## 1.2.0 — 2026-10-05

### Breaking changes

- Every CSS custom property now has the `--mc-` prefix, and the old names no longer work. Add `mc-` after the two dashes: `--icon-color` is now `--mc-icon-color`, `--chart-1` is `--mc-chart-1`, `--dialog-bg` is `--mc-dialog-bg`. This includes the theme colors that `motion-code`, `motion-code-inline`, `motion-dialog`, `motion-image-compare`, `motion-progress`, `motion-ring` and `motion-slider` read (`--mc-color-accent`, `--mc-color-accent-dim`, `--mc-color-muted`, `--mc-color-border`, `--mc-color-surface`, `--mc-color-surface-2` and `--mc-color-text`), and the scroll value `motion-scene` sets for its children: `--progress` is now `--mc-progress`.

### Fixed

- `motion-dialog`: with `light-dismiss`, pressing Enter or Space on a button inside the panel closed the dialog. Only clicks outside the panel close it now.
- `motion-progress`: under reduced motion the bar jumped to full width and ignored scrolling. It now follows scrolling, without the spring. The bar is now hidden from screen readers as decoration; before, it was a progress bar with no value.
- `motion-flip-card`: changing `trigger` after the first render had no effect. The `aria-live` region that never announced anything is removed.
- `motion-gallery`: under reduced motion, the first opened image stayed at thumbnail size. The lightbox buttons now show a keyboard focus ring.
- `motion-slider`: the arrows show a keyboard focus ring, and at the first and last slide they are `aria-disabled` and ignore activation. `motion-change` fires only when the slide changes.
- `motion-image-compare`: the slider knob was hidden from screen readers and had no name. It is now a named slider, and Home and End move the split to 0 and 100.
- `motion-ticker`: under reduced motion it no longer offers a "Press Space to pause" control that did nothing. Space and Enter on links inside the ticker work again. Screen readers and the Tab key only reach the original items, not the copies.
- `motion-swap`: `once="false"` swaps again on every viewport entry. Screen readers read the text once as words, instead of every letter twice.
- `motion-words`, `motion-countdown`: under reduced motion they keep running without animation, and `pause()`, `play()` and `cancel()` control them. `PlaybackController` delegates can opt in with `runsUnderReducedMotion`.
- `motion-typewriter`: screen readers always get the full text, not the partly typed text. The caret blinks with Motion instead of a CSS animation, stays still under reduced motion, and the text survives removing and re-adding the element.
- `motion-countdown`: `motion-finish` fires when the time runs out. In `roll` mode, screen readers read each value instead of every digit column. Under reduced motion, `finish()` stops the timer.
- `motion-spotlight`: on keyboard focus the glow shows at the center when the pointer has not moved over it.
- `motion-tilt`: focus outlines of slotted content are no longer clipped. Content with rounded corners that should clip its children needs its own `overflow: hidden`.
- `motion-split`, `motion-headline`: the full text is in a visually hidden span instead of an `aria-label` on an element with no role, which some screen readers ignore.
- `motion-scene`: under reduced motion, children now show their `data-to` end state. Before, they kept their own CSS, so a child hidden with `opacity: 0` stayed hidden.
- `motion-code-inline`: the copy button becomes visible when it has keyboard focus, with a focus outline.
- `motion-icon`: `cancel()` stops a `trigger="loop"` icon. Before, the next run still started after the pause.
- `motion-code`: code given as child `<div>` lines is dedented, like the other sources.
- Custom elements manifest: every animated component declares `motion-start`, `motion-finish` and `motion-cancel`, and `motion-words` has its description again.
- `motion-chart`, `motion-pie`: a table cell's value is the first number in the cell, so units and notes are ignored (`€12k` → 12, `3 – 5%` → 3) instead of joining every digit. Commas only group thousands. A cell's `data-value` overrides its text, for formats such as `1.234,5`.
- `motion-swap`, `motion-gravity`, `motion-curve`, and `motion-split` and `motion-headline` with `by="chars"`: text wraps between words, or after a hyphen, and never between two letters. Spaces are no longer rendered as letter spans, so they are not counted in the stagger.
- `motion-state-icon`: `toggle` without `label` logs a warning; the icon name is still used as a fallback.
- `motion-icon`: an inline `<svg>` inside another component (for example in a link wrapped by `motion-hover`) draws its outline again in Chromium. The stroke is now read from the SVG attributes, because Chromium reports no stroke while the outer component has not rendered its slot.
- `motion-icon`: the sanitizer now removes `style` attributes and decodes CSS escapes before checking for outside references, so `u\72l(...)` and `image-set(...)` can no longer load files from another server.

### Changed

- `motion-stretch`: the default `duration` is now `0.77` instead of `0.45`. With `bounce` `0.55`, the default spring now settles like the spring before 1.0 (`stiffness` 320, `damping` 16). Set `duration="0.45"` to keep the faster settle.
- `motion-perspective`: `oscillate` is now `loop`, the name every other repeating component uses. `oscillate` still works.

### Added

- New text annotation components that draw a mark onto their text when it scrolls into view, on hover, or on mount: `motion-marker` (a highlighter stroke behind the text, straight or with `shape="wave"`), `motion-underline` (`shape` is `line`, `dashed`, `dotted`, `wave` or `zigzag`), `motion-strike` (a line through the text) and `motion-ring` (an ellipse, or a box with `shape="box"`, around a word). Marker, strike and the straight, dashed and dotted underlines follow text that wraps across lines. Colors and thickness are set with `--mc-marker-color`, `--mc-mark-color` and `--mc-mark-thickness`; new CSS custom properties now use the `--mc-` prefix.
- Loop mode for text and marks: `loop` repeats the effect with a pause between runs on `motion-counter`, `motion-font`, `motion-headline`, `motion-scramble`, `motion-split`, `motion-swap`, `motion-text-mask`, `motion-typewriter`, `motion-marker`, `motion-underline`, `motion-strike` and `motion-ring`. `hold` sets the seconds in the end state, `gap` the seconds before the next run, and `pause-on-hover` freezes the cycle while the pointer is over the element. With `trigger="view"` the loop runs while the element is on screen and starts again on the next entry; `once` is ignored. Under reduced motion the element shows its end state. `motion-typewriter` already had `loop` and `hold`, and now also has `gap` and `pause-on-hover`.
- Usage guidance in every component's documentation comment: when to use it, when not to, accessibility, reduced motion and common mistakes. It appears in editor hovers through the custom elements manifest, and in the Markdown docs and `llms-full.txt` on the site.
- `motion-icon`: `animation` takes `draw` plus a motion, such as `draw wiggle` or `draw pulse`, to draw the outline and move the icon at the same time. On filled icons only the motion runs.
- `motion-code`: reads its code from a `<pre>` child, so the code is in the page HTML for search engines and readers without JavaScript.

## 1.1.2 — 2026-10-04

### Fixed

- `motion-chart`: when the data changed to a smaller scale, the axis jumped while the bars sprang, so bars were drawn far above the chart. The axis range now springs with the bars, without bounce, and bars and lines are clipped to the chart area. Changes to `min` and `max` animate the same way.

## 1.1.1 — 2026-10-03

### Fixed

- The CDN snippet in the README uses jsDelivr's `+esm` build. The files in `dist/` import `lit` and `motion` by bare name, which a browser cannot load from the CDN directly.
- Every export has a `default` condition, so `require()` works on Node 20.19+, 22.12+ and 23+.
- `motion-code` and `motion-code-inline` list the `--color-*` theme colors they read, so they appear in `custom-elements.json` and in editor completions.

## 1.1.0 — 2026-10-03

### Added

- New **Icons** category.
- `motion-icon`: animates any SVG icon. `animation` is `draw` (strokes draw in), `pop`, `bounce`, `rotate`, `wiggle` or `pulse`; `trigger` is `hover`, `click`, `view`, `mount` or `loop`. Pass the icon as a child `<svg>` or as markup in `icon` (for example `import { Heart } from "lucide-static"`); script and event handlers are removed. Works with Lucide, Tabler, Heroicons, Iconoir and Feather; filled sets such as Phosphor and Bootstrap fall back from `draw` to `pop`. Color and size with `--icon-color` and `--icon-size`.
- `motion-state-icon`: eight icons that morph between two states on a spring: `menu`, `play`, `copy`, `plus`, `chevron`, `heart`, `loading` and `eye`. Set `active` for the second state, or `toggle` to make it a button that switches itself and fires `motion-change`. `--icon-accent` colors the filled heart (red by default) and the checks (green by default).

## 1.0.0 — 2026-10-03

The first stable release. Attribute names, units and spring settings are now consistent across all 40 components, and from here on they only change in a major version. Every rename, with how to convert it, is in the migration guide: https://www.motion-components.dev/docs/migration/

### Breaking changes

- **Time is always in seconds.** `motion-glitch` and `motion-words` `interval`, `motion-typewriter` and `motion-scramble` `delay`, and the `motion-code` typing delays were milliseconds. Divide old values by 1000.
- **`speed` only means a rate per second** (`motion-ticker`, `motion-curve` `loop-speed`, `motion-code` `typing-speed`). Other `speed` attributes are renamed by what they do:
  - `motion-circle`, `motion-arc`: `speed` → `duration` (seconds per rotation).
  - `motion-perspective`: `speed` → `duration` (seconds per cycle, `1 / speed`); `animate` → `oscillate`.
  - `motion-liquid`: `speed` → `duration` (seconds per cycle, `9 / speed`).
  - `motion-curve`: `speed` → `wave-duration` (seconds per wave, `1 / speed`).
  - `motion-parallax`: `speed` → `depth`.
  - `motion-typewriter`: `speed` → `interval`, `pause` → `hold`. `motion-scramble`: `speed` → `interval`.
- **Springs use `duration` and `bounce`.** `motion-stretch` drops `stiffness`/`damping`; `motion-swap` drops the `transition` object; `motion-spotlight` drops `smoothing` and `fade-duration` and now follows the cursor on a spring; `motion-gravity` drops its fixed spring (so `duration` now works) and gains `bounce`.
- **Renamed attributes:** `motion-blur`/`motion-blur-in` `blur` → `intensity`; `motion-swap` `stagger-duration` → `interval`; `motion-gravity` `stagger` → `interval`; `motion-code` `type`, `type-speed`, `type-delay`, `type-loop-delay`, `no-loop` → `typing`, `typing-speed`, `typing-delay`, `typing-hold`, `typing-loop` (default on).
- **Triggers:** `'view'` means when scrolled into view and `'mount'` means once on load. `motion-font` `auto` → `view`, `motion-swap` `reveal` → `view`, `motion-glitch` `auto` → `mount`, and `motion-scramble` boolean `hover` → `trigger="hover"`.
- **Colors move to CSS custom properties:** `motion-progress` `color` → `--progress-color`, `motion-spotlight` `color` → `--spotlight-color`. `motion-code` token colors `--cw-*` → `--code-*`.
- **Events:** `motion-slider` fires `motion-change` instead of `slidechange`.
- **`motion-theme-toggle`:** the page wipe is off by default. The boolean `wipe` replaces `transition="wipe" | "none"`.

### Added

- Every boolean attribute accepts `"false"`, so flags that default to on (`once`, `pin`, `labels`, `arrows`, `cursor` and others) can be turned off in HTML.
- `bounce` on `motion-press`, `motion-magnetic` and `motion-gravity`; `duration` and `bounce` on `motion-tilt`.
- `icon-only` on the `motion-theme-toggle` `toggle` appearance.
- `@cssprop` documentation for `motion-countdown`, `motion-dialog` and `motion-progress`.
- Tests for every component (472 in total) and a `check:ssr` step in the release checks.

### Fixed

- **Security:** `motion-split`, `motion-headline` and `motion-glitch` inserted their text as HTML without escaping, so markup in the text could run. Text is now escaped.
- Registering a component twice (for example from two bundles) no longer throws.
- Importing the library during server-side rendering no longer throws.
- `once="false"` replays every time the element scrolls into view in `motion-reveal`, `motion-blur-in`, `motion-stagger`, `motion-split`, `motion-headline`, `motion-text-mask` and `motion-font`.
- With reduced motion, `motion-split` and `motion-headline` show their text at once instead of waiting to scroll into view.
- Screen readers read the whole text once in `motion-arc`, `motion-circle`, `motion-curve`, `motion-gravity` and `motion-perspective`.
- `motion-font`: playback and hover control every axis, not just the first; hover respects reduced motion.
- `motion-curve`: the wave speed no longer depends on the screen's refresh rate.
- `motion-liquid`: `pause-on-hover` and the playback methods work without calling `play()` first.
- `motion-stagger` shows children added after the reveal; `motion-blur`'s `once` latch fires `motion-finish`.
- `motion-words` keeps commas inside `rgb()` and `hsl()` colors and picks up new `words`/`colors`.
- `motion-dialog` stays open when reopened during its closing animation.
- `motion-perspective` with a single letter, `motion-circle` `finish()`, and a still `motion-arc` playback state.

## 0.7.1 — 2026-10-02

### Fixed

- `motion-theme-toggle` storage is scoped per `target`. A toggle for `<html>` (or `:root`) keeps using `motion-theme`; any other target uses `motion-theme:<target>`. Previously every toggle shared one key, so a scoped toggle read and overwrote the page-level choice.
- `motion-theme-toggle` peer sync no longer clobbers a saved choice. Only user-driven changes propagate to peer toggles, and a peer that was updated by sync does not write to storage. A toggle rendered without `system` used to replace a saved `system` choice on load.
- `motion-theme-toggle` re-measures the segmented pill and the switch thumb with a `ResizeObserver`, so the selection indicator is positioned correctly on first render.

## 0.7.0 — 2026-10-02

### Added

- `motion-theme-toggle`: a light, dark and system theme control.
  - Four appearances: `icon`, `toggle`, `switch` and `menu`.
  - A circular view transition wipe built on Motion's `animateView`, tuned with `duration` and `bounce`. Set `transition="none"` to switch it off.
  - API parity with `dark-mode-toggle`: the `mode`, `permanent`, `legend` and `remember` attributes, the `colorschemechange` and `permanentcolorschemechange` events, and `prefers-color-scheme` stylesheet switching.
- `motion-theme-icon`: a reusable sun, moon and system glyph that morphs between states with a spring.

### Changed

- `motion` moves from `^11.11.0` to `^13.5.0`. The library targets the `AnimationPlaybackControlsWithThen` type, so animation handles that rely on `.then` now typecheck. `skipLibCheck` is enabled to keep the upgrade clean.

## 0.6.0 — 2026-08-18

### Fixed

- `motion-ticker` hover pause/resume: decelerates on hover, holds position, resumes without jumping.
- Keyboard pause (Space) now matches hover behavior.
- Live attribute changes (`speed`, `gap`, `direction`) no longer cause position jumps.
- `gap` attribute is now live.
- Direction flips no longer teleport the track.
- Keyboard pause is preserved across pointer visits.
- Container resize tops up the track.
- Wave geometry is re-measured on rebuild.

## 0.5.0 — 2026-07-28

### Removed

- `duration` on `motion-tilt`, `motion-blur` and `motion-words`, and `threshold` on `motion-blur`. These were never read by their implementations, so setting them had no effect. Drop them from your markup. The same-named attributes on `motion-blur-in` are real and unaffected.

### Fixed

- `MotionCodeProps` declared `lang` where `motion-code` implements `codeLang`, so `<motion-code lang="js">` typechecked but was ignored at runtime.
- Boolean attributes that default to `true`, meaning the `once` family plus `motion-countdown.labels`, `motion-scene.pin`, `motion-swap.reverse` and `motion-typewriter.cursor`, now document that they cannot be switched off from markup. `once="false"` reads as `true`, as with any HTML boolean attribute; use the property instead (`el.once = false`). The tristate attributes on `motion-gallery`, `motion-slider` and `motion-ticker` do accept `="false"`.
- `motion-slider` no longer declares `observedAttributes` it never acted on. `gap` and `arrows` are read once while the slider is built.
- `motion-stagger.from` no longer claims to accept a numeric index, and the `motion-countdown` / `motion-scene` examples no longer show bare no-op booleans.

### Changed: editor and tooling metadata

The custom elements manifest is now complete enough to drive editor tooling and codegen on its own.

- `motion-ticker`, `motion-slider` and `motion-gallery` used class-level `@property`, which the analyzer treats as a member rather than an attribute, so their attributes shipped with no type, default or description. `motion-slider` shipped no documented API at all. They now use `@attr`.
- `motion-code` and `motion-code-inline` had no JSDoc; both are now documented, including `motion-code`'s token-colour custom properties.
- The `Controllable` playback API (`play`, `pause`, `finish`, `cancel`, `playState`, `finished`) is documented, covering every component that uses it.
- Enum attributes report their literal values, so `motion-stagger.from` is now `'first' | 'last' | 'center'` rather than `StaggerFrom` and editors offer real completions.
- `@example` blocks are preserved under `examples`; every component ships usage markup.

## 0.4.2 — 2026-07-16

### Fixed

- Watch mode (`npm run dev`) no longer wipes CEM artifacts from `dist/` on rebuild.
- Removed redundant CSSStyleSheet boilerplate from `motion-counter`, `motion-scramble`, `motion-swap`, `motion-ticker`, and `motion-typewriter`. FOUC prevention for these components is handled by `preload.css`.

## 0.4.1 — 2026-07-14

### New

- Editor metadata is now generated from the custom elements manifest on every build. The package ships `dist/web-types.json` (picked up automatically by JetBrains IDEs via the `web-types` field) and `dist/vscode.html-custom-data.json` / `dist/vscode.css-custom-data.json` (wire them up via `html.customData` / `css.customData` in VS Code settings). This gives tag completion, attribute completion, and hover docs for all `motion-*` elements in HTML and template files.

## 0.4.0 — 2026-07-14

### New

- Text components that render from a `text` attribute — `motion-stretch`, `motion-liquid`, `motion-curve`, `motion-gravity`, and `motion-perspective` — now fall back to their child text when the attribute is unset: `<motion-stretch>Animate</motion-stretch>`. Child text doubles as a pre-upgrade fallback, so the page shows plain text instead of an empty gap until the element is defined. The `text` attribute still takes precedence when both are present and is the right choice for dynamic content since setting the property restarts the animation.
- `text` property made optional (`text?: string`) on `motion-circle` and `motion-arc` for consistency.

## 0.3.0 — 2026-07-13

### New: JavaScript playback API

Every animation component now implements a shared imperative playback interface:

- `play()` — start if idle/finished, resume if paused; returns the run's `finished` promise
- `pause()` — freeze in place, resumable with `play()`
- `finish()` — jump to the end state immediately
- `cancel()` — hard-stop and reset to the initial state
- `playState` — `'idle' | 'running' | 'paused' | 'finished'`
- `finished` — per-run promise, resolves on finish or cancel, never rejects

Components emit bubbling, composed `motion-start`, `motion-finish`, and `motion-cancel` events, so playback can be observed from any ancestor.

Global controls are exported from the package root, each accepting an optional root node to scope the effect:

```js
import { pauseAll, resumeAll, cancelAll } from 'motion-components'
```

`pauseAll()` also disables input-reactive components; `resumeAll()` re-enables only the ones it disabled.

### New

- `disabled` property/attribute on `motion-hover`, `motion-press`, `motion-magnetic`, and `motion-tilt` — the component settles and stops responding to input.
- `prefers-reduced-motion: reduce` now jumps `play()` straight to the final state while still resolving the `finished` promise and firing events, so control flow keeps working.

### Breaking

- `code-window` renamed to `motion-code`, `code-inline` renamed to `motion-code-inline`. Both the tag names and the import subpaths changed:
  - `motion-components/code-window` → `motion-components/motion-code`
  - `motion-components/code-inline` → `motion-components/motion-code-inline`
- `motion-typewriter`: the `pause` **property** was renamed to `pauseTime` to make room for the new `pause()` method. The HTML `pause` attribute is unchanged.

## 0.2.0 — 2026-05-31

- New `motion-swap` text component.
- Fixed `motion-dialog` backdrop behavior.
- Fixed `motion-curve` animation timing.
- Rewrote `motion-liquid` with SMIL animations.
- README component docs, live-preview links, and showcase section.

## 0.1.0 — 2026-05-10

- Initial release: spring-physics `motion-*` web components built with Lit and Motion — reveal, respond (hover/press/magnetic/tilt), text effects, scroll (parallax/scene), interactive widgets, and code display — with per-component subpath imports and FOUC preload support.
