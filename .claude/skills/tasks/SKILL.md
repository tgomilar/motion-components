---
name: tasks
description: Break a PRD or feature description into discrete, actionable work items ordered by dependency. Outputs a numbered list of tasks ready to implement one at a time, each small enough to complete in a single session.
---

# tasks

Take a PRD (from `/plan`) or any feature description and decompose it into a numbered list of discrete, self-contained work items. Each issue must be small enough to implement and verify in a single focused session. Order them by dependency so they can be executed top-to-bottom without backtracking.

## When to use

- After `/plan` produces a spec and you're ready to start breaking ground
- A feature is too large to implement in one go
- You want a clear execution checklist before starting

## Output format

Produce a numbered list. Each issue follows this template:

```
### Issue N: <short title>

**Goal:** One sentence — what will be true when this issue is done.
**Files touched:** List the files that will be created or modified.
**Inputs:** What must exist before this issue can start (previous issue numbers, or "none").
**Steps:**
1. ...
2. ...
**Done when:** Specific, observable condition. (e.g., "`npx tsc --noEmit` passes", "the docs preview renders the animation", "the prop is reflected as an attribute in DevTools")
```

## Standard issue breakdown for a new motion-* component

When the input is a new component, always produce issues in this order:

1. **Types contract** — create `<tag>.types.ts` with the props interface. No implementation yet.
2. **Component skeleton** — create `<tag>.ts` with `LitElement` shell, all `@property` declarations, `static styles`, and a no-op `render()`. No animation logic yet. Wire Vite entry + `src/index.ts` re-export + `package.json` export.
3. **Core animation** — implement the primary animation using Motion One. Props wired. Reduced-motion branch included.
4. **Docs page** — create the Astro docs page with `<DocsPreview>`, `<CodeWindow>`, and `<PropsTable>`. Component must be visually complete.
5. **Polish & edge cases** — handle interruption, initial state, attribute reflection, and any variant props from the PRD.
6. **Typecheck gate** — run `npx tsc --noEmit` and fix all errors. This is always the final issue.

For site-only features (no new component), collapse as appropriate but keep typecheck as the last issue.

## Rules

- No issue should touch more than 4–5 files.
- No issue should have more than ~6 steps.
- Every issue must have a "Done when" condition that is observable without running tests.
- If two things can't be decoupled, keep them in one issue — don't force an artificial split.
- Don't create an issue for "planning" or "research" — those happen before this skill runs.

## Next step

After issues are defined, execute them top-to-bottom using the **`new-component`** skill (`.claude/skills/new-component/SKILL.md`) for new components, or follow the project's standard edit workflow for modifications.

## References

- PRD input: **`plan`** skill (`.claude/skills/plan/SKILL.md`)
- Implementation: **`new-component`** skill (`.claude/skills/new-component/SKILL.md`)
- Style conventions: **`style-guide`** skill (`.claude/skills/style-guide/SKILL.md`)
- Spec-first loop: **`spec-first`** skill (`.claude/skills/spec-first/SKILL.md`)
- Release gate: **`release`** skill (`.claude/skills/release/SKILL.md`)
