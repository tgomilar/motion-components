---
name: new-component
description: Scaffold a new motion-* web component end-to-end — TypeScript source, types file, Vite build entry, package.json subpath export, src/index.ts re-export, and a docs page. Use when the user asks to add, scaffold, or create a new component named like motion-X.
---

# new-component

Add a new component to the motion-components library. Components live under `src/<category>/<tag>/<tag>.ts` (and `<tag>.types.ts`), are re-exported from `src/index.ts`, registered as a Vite library entry in `vite.config.ts`, exposed as a `package.json` subpath export, and documented at `site/src/pages/docs/<category>/<tag>.astro`.

## Categories

Place the new component under one of these directories:

- `src/reveal/` — entrance & transition effects (reveal, stagger, blur, blur-in).
- `src/respond/` — input-driven wrappers (hover, press, magnetic, tilt). Compose around any slotted content.
- `src/text/` — typography effects (split, headline, scramble, typewriter, counter, ticker, words, glitch, perspective, stretch, liquid, gravity, font, curve, circle, arc, swap, text-mask).
- `src/scroll/` — scroll-driven (parallax, scene). Use Motion One's `scroll()` primitive.
- `src/components/` — discrete interactive widgets (slider, gallery, dialog, countdown, spotlight, progress, image-compare, flip-card).
- `src/code/` — code-rendering elements (motion-code, motion-code-inline). Rare; only for syntax-highlighted output.

If the new component doesn't clearly fit, prefer `components/` over inventing a new directory.

## Conventions to follow

- **Class name:** PascalCase, e.g. `MotionFooBar` for `<motion-foo-bar>`.
- **Lit + Motion One:** import `LitElement, html, css` from lit; import `animate` (or `scroll`, `stagger`) from `motion`. Don't use raw CSS keyframes — every animation should go through Motion One.
- **Reactive properties:** declare with `@property({ type: ... })`. Map kebab-case attributes via `attribute: 'foo-bar'` when the JS name doesn't match. For attribute selectors to work, set `reflect: true`.
- **Spring physics:** prefer `{ type: 'spring', bounce, duration }` over duration + easing. Springs continue from current velocity when interrupted.
- **prefers-reduced-motion:** check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and degrade — usually skip the animation and apply the final state.
- **CEM JSDoc (full):** every component gets a `/** … */` block above the class with `@element`, `@slot`, `@property` (one per public attribute), `@fires` (if applicable), `@cssprop`/`@csspart` (if applicable), and `@example`. For LitElement components, also add a `/** Description. */` above each `@property` decorator. Public methods get a `/** … */` JSDoc too. See `style-guide` skill for the full CEM conventions.
- **No non-CEM comments:** strip all inline `//` comments, CSS section dividers, and property-level comments that aren't valid CEM annotations. Only the class-level JSDoc block and `@property`-level JSDoc are permitted.
- **Types file:** `<tag>.types.ts` defines the props interface (matches reactive properties) and any string-literal types.
- **Tests:** none in repo currently; do not add a test framework.

## Template for `<tag>.ts`

```ts
import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { animate } from 'motion'
import type { MotionFooProps } from './motion-foo.types.js'

export type { MotionFooProps } from './motion-foo.types.js'

/**
 * Short one-liner describing what this does.
 *
 * @element motion-foo
 *
 * @slot - Description of default slot.
 *
 * @property {number} amount - What it does. Default `10`.
 * @property {number} duration - Spring duration in seconds. Default `0.5`.
 * @property {number} bounce - Spring bounciness. Default `0.2`.
 *
 * @example
 * ```html
 * <motion-foo amount="12">
 *   <div>Wrapped content</div>
 * </motion-foo>
 * ```
 */
@customElement('motion-foo')
export class MotionFoo extends LitElement implements MotionFooProps {
  /** What it does. */
  @property({ type: Number }) amount = 10
  /** Spring duration in seconds. */
  @property({ type: Number }) duration = 0.5
  /** Spring bounciness. */
  @property({ type: Number }) bounce = 0.2

  static styles = css`
    :host { display: inline-block }
  `

  private get _reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  // …event handlers, animate() calls…

  render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-foo': MotionFoo
  }
}
```

## Template for `<tag>.types.ts`

```ts
export interface MotionFooProps {
  amount: number
  duration: number
  bounce: number
}
```

## Wiring checklist (do all of these in one pass)

For a component named `motion-foo` placed in `src/<category>/motion-foo/`:

1. **Source files** — create `motion-foo.ts` and `motion-foo.types.ts` in `src/<category>/motion-foo/`.
2. **Re-export** — add to `src/index.ts`:
   ```ts
   export { MotionFoo } from "./<category>/motion-foo/motion-foo.js";
   ```
3. **Vite build entry** — add to the `entries` map in `vite.config.ts`:
   ```ts
   'motion-foo': 'src/<category>/motion-foo/motion-foo.ts',
   ```
4. **Package subpath export** — add to `package.json` `exports`:
   ```json
   "./motion-foo": {
     "types": "./dist/<category>/motion-foo/motion-foo.d.ts",
     "import": "./dist/motion-foo.js"
   }
   ```
5. **FOUC preload (optional)** — if the component hides slotted content while animating in (e.g. reveal-style entrance), add a rule to `src/preload.ts` `RULES`:
   ```ts
   'motion-foo': 'motion-foo:not(:defined){opacity:0}',
   ```
   Skip this for hover/click/scroll-driven components that don't need to hide on first paint.
6. **Docs page** — copy an existing page that matches the kind of component (e.g. `site/src/pages/docs/primitives/motion-hover.astro` for an interactive primitive) into `site/src/pages/docs/<category>/motion-foo.astro` and edit. The sidebar (`DocsSidebar.astro`) auto-discovers via `import.meta.glob`, so no nav edit needed. Each docs page must include:
   - `<Layout title="motion-foo — Motion Components" noMain>` and the `.layout` grid wrapper.
   - `<DocsSidebar />`, `<DocsTOC />`, `<DocsPagination />`.
   - One or more `<DocsPreview>` blocks with the live tag.
   - At least one `<CodeWindow>` showing per-component import: `import 'motion-components/motion-foo'` (and the bulk option below it).
   - A `<PropsTable>` with `nameLabel="Attribute"` listing every attribute, type, default, and a short description.
   - An "Accessibility" `<h2>` covering keyboard + reduced-motion behaviour.
   - `<script>import "motion-components"</script>` at the bottom.

## Verifying

After wiring, run:

```bash
npx tsc --noEmit
```

The repo's `prepublishOnly` script runs `npm run typecheck && npm run check:preload && npm run build && npm run size`. Don't trigger that during scaffolding; it's for releases.

## Common mistakes to avoid

- Don't add a `font-family` on `:host` — let inheritance work.
- Don't set `display` to anything but `block`, `inline-block`, or `contents` unless you really need a flex/grid host.
- Don't import `lit` or `motion` as transitive deps in source — they're externalised by Vite.
- Don't reach into the slotted children's shadow DOM; only act on the element's own DOM (the slotted children's *light* DOM is fine).
- Don't ship a component that fights `prefers-reduced-motion`. Always degrade gracefully.

## Input from other skills

This skill is the implementation step. Before calling it, you should have:
- **`clarify`** — requirements clarified
- **`plan`** — formal PRD spec
- **`tasks`** — actionable issue breakdown

## References

- Spec-first development: **`spec-first`** skill (`.claude/skills/spec-first/SKILL.md`)
- Style conventions: **`style-guide`** skill (`.claude/skills/style-guide/SKILL.md`)
- Pre-publish verification: **`release`** skill (`.claude/skills/release/SKILL.md`)
