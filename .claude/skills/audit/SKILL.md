---
name: audit
description: Audit the codebase for animation primitive violations, duplicated animation logic, composition opportunities, and architectural drift. Produces a prioritized list of improvements with specific file locations.
---

# audit

Systematically explore the codebase to surface architectural problems and opportunities. The output is a prioritized, actionable report — not a rewrite. Each finding must cite a specific file and line, describe the problem, and propose the fix.

## What to look for

Run through each category below. Read the relevant source files. Form concrete findings.

### 1. Primitive bypass violations

Components that define their own animation logic instead of composing `<motion-hover>`, `<motion-press>`, `<motion-reveal>`, or `<motion-stagger>`.

Look for: `animate()` calls inside `connectedCallback`, `mouseenter`/`mouseleave` listeners, `click` handlers, or `IntersectionObserver` usage directly inside component files that are NOT in `src/primitives/`.

**Check:** `src/interaction/`, `src/text/`, `src/scroll/` for any `animate()` calls.

### 2. Duplicated animation logic

The same spring params, easing, or transform pattern repeated across multiple components.

Look for: identical or near-identical `animate(el, { ... }, { type: 'spring', bounce: X, duration: Y })` calls in more than one file.

**Fix candidate:** extract to a shared spring preset in a `src/utils/springs.ts` or move to a primitive.

### 3. Missing `prefers-reduced-motion` guards

Components that animate but don't check `window.matchMedia('(prefers-reduced-motion: reduce)').matches`.

Look for: any component with an `animate()` call that has no `if (this._reduced)` branch.

### 4. Reflect inconsistency

Props that control visible or structural state but are not reflected to attributes (`reflect: true` missing), making CSS attribute selectors and external queries unreliable.

Look for: `@property` declarations where the prop value affects visible rendering but `reflect` is absent or `false`.

### 5. Spring vs easing drift

Components using `ease`, `easeInOut`, or numeric `easing` arrays instead of `{ type: 'spring' }`. The library philosophy mandates spring-based motion.

Look for: `easing:` keys in `animate()` calls inside `src/`.

### 6. Docs page gaps

Components that exist in `src/` but either have no docs page, or have a docs page missing the `<PropsTable>`, an Accessibility section, or a live preview.

Look for: component directories in `src/` that don't have a corresponding page in `site/src/pages/docs/`.

### 7. Vite entry / export mismatches

Component source files that exist in `src/` but are missing from `vite.config.ts` entries, `src/index.ts` re-exports, or `package.json` subpath exports.

Look for: `.ts` files in `src/*/` that match the `motion-*` naming pattern but aren't wired end-to-end.

## Output format

Produce a report with these sections:

```
# Architecture Audit — <date>

## Critical (breaks contract or causes bugs)
- [file:line] Problem description → Proposed fix

## Important (violates library philosophy)
- [file:line] Problem description → Proposed fix

## Nice to have (polish, DX, consistency)
- [file:line] Problem description → Proposed fix

## No issues found
- Category N: clean
```

List findings by severity. For each finding, link to the specific file and line. Keep descriptions to one sentence. Be specific about what should change.

## Rules

- Read the actual source files before reporting. Don't guess from filenames.
- A finding without a specific file:line is not a finding.
- Don't report style opinions (formatting, naming casing) — only architecture, animation contract, and philosophy violations.
- After the report, ask: "Which of these would you like to address first?" Do not start fixing without direction.

## References

- Style conventions: **`style-guide`** skill (`.claude/skills/style-guide/SKILL.md`)
- Fixing discovered issues: **`new-component`** skill (`.claude/skills/new-component/SKILL.md`)
- Release gate: **`release`** skill (`.claude/skills/release/SKILL.md`)
