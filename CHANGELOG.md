# Changelog

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
