---
name: style-guide
description: The motion-components project conventions — code style, component architecture, animation rules, doc page structure, naming, and what NOT to do. Reference this whenever editing source, adding components, or writing docs pages.
---

# motion-components style guide

A short, opinionated guide to the conventions in this repo. Read this before adding code or pages.

## Core philosophy

- **Motion-first.** Animation is part of the component, not bolted on. Every visible state change goes through Motion One.
- **Composition over configuration.** Wrap a tag inside a tag. Don't add config flags that re-implement what another component already does.
- **Springs over curves.** Spring physics by default — `{ type: 'spring', bounce, duration }`. Cubic-bezier easing only when the effect demands a fixed shape (linear scroll-binding, looping marquees).
- **Standards over abstractions.** Lit + native custom elements. No framework adapters. The browser is the runtime.
- **Accessibility is not optional.** `prefers-reduced-motion` is checked at the animation layer, not by the consumer.

## Code style

- TypeScript everywhere in `src/`. Astro/TypeScript everywhere in `site/`.
- No emojis in source files unless the user asks. Decorative glyphs in JSX (`✦`, `↗`) are fine.
- Default to writing **no comments**. Only add a comment when the *why* is non-obvious — a hidden constraint, a workaround, a behaviour that would surprise a reader. Don't narrate what well-named code already says.
- No multi-paragraph docstrings on internal helpers. The JSDoc on a component class drives the docs site, so it's worth writing well; everything else is optional.
- Don't add error-handling for things that can't happen. Trust framework guarantees. Validate at boundaries (user input, external APIs), not internally.
- Don't introduce abstractions for hypothetical future needs. Three similar lines beat a premature helper.
- No backwards-compat shims, "removed" comment markers, or unused re-exports left behind. Delete cleanly.

### CEM JSDoc conventions (Custom Elements Manifest)

Every component class must have a `/** … */` block above the class (or `@customElement` decorator) with:
- `@element <tag-name>`
- `@slot` — one for the default slot (`- Description.`) or each named slot
- `@property {type} name - Description.` — one per public attribute/property. Use kebab-case attribute names. Include the default value in the description.
- `@fires <event-name> — Description.` — only if the component dispatches custom events
- `@cssprop` — only if the component exposes CSS custom properties (rare)
- `@csspart` — only if the component exposes shadow parts (rare)
- `@example` — with a ```html code block showing real usage

For **LitElement** components: add a `/** Description. */` JSDoc above each `@property` decorator. The CEM analyzer reads these directly. Keep them short — one sentence.

For **plain HTMLElement** components (no `@property` decorator): list every observed attribute in the class-level `@property` tags.

**Public methods** get a `/** Description. */` JSDoc above the method definition.

**Only CEM JSDoc is allowed.** No inline `//` comments, no `/* … */` section dividers in CSS or logic, no property-level comments that aren't valid CEM annotations. If the *why* is non-obvious, refactor for clarity instead of commenting.

## Component architecture

- File layout: `src/<category>/<tag>/<tag>.ts` plus `<tag>.types.ts`. One component per directory.
- Categories: `primitives` (interactive wrappers), `text` (typography effects), `scroll` (scroll-driven), `interaction` (discrete widgets), `code` (code rendering).
- `LitElement` subclass with `@customElement('motion-tag')` and `@property` for every attribute.
- Use `attribute: 'kebab-case'` mapping when JS name differs from attribute. Add `reflect: true` if the attribute selector needs to match values set via JS.
- Public methods (e.g. `replay()`) are part of the API — document them in JSDoc and the docs page.
- Default slot is fine for most wrappers. Use named slots (`slot="before"`, `slot="after"`, `slot="front"`, `slot="back"`) when content has a known role.

### Animation rules

- Import only what's used: `import { animate } from 'motion'`. `scroll`, `stagger`, `inView` for scroll/stagger/view triggers.
- Spring options: `{ type: 'spring', duration, bounce }`. Avoid `stiffness`/`damping` unless the component needs that level of control.
- Always store a reference to long-lived `AnimationPlaybackControls` so they can be `.stop()`ed in `disconnectedCallback`.
- For loops, prefer `repeat: Infinity` on a Motion animation over `setInterval`. The motion runs on the same scheduler.
- Reduce motion: short-circuit at the top of any animation entry point — apply final state and return.

### FOUC prevention

- Components that hide slotted content on first paint (entrance reveals, splits, blurs, etc.) must have a `:not(:defined){opacity:0}` rule in `src/preload.ts`. Hover/click/scroll wrappers don't.
- Inside the component, set the visible-only-when-ready guard *synchronously* (in `connectedCallback` or via a `:host(:not([data-ready]))` style) before the first animation frame. Don't rely on `animate(..., { duration: 0 })` — that's an async microtask and the original content can flash.

## Docs pages

Every component gets one Astro page at `site/src/pages/docs/<category>/<tag>.astro`. Use an existing peer page as the template. Required sections:

1. `<Layout title="<tag> — Motion Components" noMain>` and `.layout` grid.
2. `<DocsSidebar />`, `<DocsTOC />`, `<DocsPagination />`.
3. Title — `<motion-split by="chars" interval="0.025" duration="0.5">tag-name</motion-split>`.
4. Lead paragraph — one sentence on what it does + one on the unique behaviour.
5. **Preview** — at least one `<DocsPreview>` with the live tag.
6. **Import** — show per-component first, bulk second:
   ```ts
   import 'motion-components/motion-tag'   // just this one
   import 'motion-components'               // or the whole library
   ```
7. **Usage** — `<CodeWindow>` with a copy-pasteable HTML example.
8. **Properties** — `<PropsTable nameLabel="Attribute" rows={[...]}/>` listing every attribute, type, default, description.
9. **Slots** (if named slots) — same `<PropsTable>` pattern.
10. **Methods** (if any) — small HTML table.
11. **Accessibility** — what works for keyboard / screen-readers / reduced-motion. Always present, even if just one sentence.
12. `<script>import "motion-components"</script>` at the bottom.

The sidebar auto-discovers pages via `import.meta.glob`. No manual nav edit required.

## Naming

- Tags: `motion-<name>`, kebab-case, no abbreviations. `motion-image-compare`, not `motion-img-cmp`.
- Classes: `Motion<Name>` PascalCase. Match the tag.
- Attributes: kebab-case. Booleans are presence-based (`<motion-foo loop>`), not `loop="true"`.
- Component-specific CSS classes outside of Lit shadow: prefix with the tag — `.docs-toc`, `.fw-tabs`, `.sc-hero` (showcase-page-scoped). The showcase namespace is `sc-`.

## What NOT to do

- Don't use CSS keyframes for component animations. Always go through Motion One.
- Don't ship `setInterval`-driven loops where Motion's `repeat: Infinity` works.
- Don't add framework wrappers (`react-motion-components`, etc.). Custom elements work everywhere.
- Don't add a config field for what composition can already express. Wrapping `<motion-hover>` in `<motion-stagger>` is correct; adding `stagger` as an attribute on `<motion-hover>` is not.
- Don't import from another component's internals — share via `src/<cat>/utils/` if you genuinely need shared logic (see `text/utils/split-text.ts`).
- Don't create new top-level directories without a real reason.
- Don't write setup/teardown logic that depends on shadow DOM internals leaking through slots — the slot is a contract.
- Don't add tests using a framework that isn't already in the repo.

## Showcase page

The `/showcase/` page is intentionally framed as a fictional **specimen book** ("Motion Specimen N°01"). It uses its own scoped namespace (`.sc-*`), its own palette overrides, and its own typographic system. Treat it like a different document — don't share its colours or layout patterns with the docs pages or marketing pages. The Layout's `showBg` is disabled for `/showcase/*` so the project's grid backdrop doesn't bleed through.

## When in doubt

- Read the closest existing peer (component or docs page) and match its structure.
- Don't refactor neighbouring code while making a local change. Ship the smallest correct diff.
- If something feels redundant, ask — there may be a reason.

## References

- Component scaffolding: **`new-component`** skill (`.claude/skills/new-component/SKILL.md`)
- Spec-first development: **`spec-first`** skill (`.claude/skills/spec-first/SKILL.md`)
- Architecture audit: **`audit`** skill (`.claude/skills/audit/SKILL.md`)
- Release verification: **`release`** skill (`.claude/skills/release/SKILL.md`)
