# Changelog

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
