---
name: plan
description: Turn a vague component idea or feature request into a structured Product Requirements Document covering purpose, props API, animation behavior spec, accessibility, and docs structure. Use before implementing anything non-trivial.
---

# plan

Convert a component idea or feature request into a formal Product Requirements Document (PRD). Output a complete spec that can be handed to `/new-component` or used as a reference during implementation. The PRD becomes the source of truth — implementation must match it, not the other way around.

## When to use

- A new `motion-*` component is being planned
- A significant change to an existing component is proposed
- The user has answered `/clarify` questions and is ready to formalize requirements
- Multiple people need alignment before work starts

## Output format

Produce a markdown document with exactly these sections:

---

# PRD: `<motion-tag-name>`

## Summary
One paragraph. What this component does, why it exists, and what problem it solves for the developer using the library.

## Category
Which source directory: `primitives` / `text` / `scroll` / `interaction` — and the rationale.

## Composes
Which motion primitives this component builds on (if any): `<motion-reveal>`, `<motion-hover>`, `<motion-press>`, `<motion-stagger>`, or "none — novel widget".

## Props / Attributes API

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `foo` | `string` | `"bar"` | What it controls. |

List every attribute. For string-literal types, list the accepted values.

## Animation Behavior

Describe the animation in plain English:
- **Trigger:** what starts it
- **Forward:** what happens on trigger (keyframes, spring params)
- **Reverse:** what happens when trigger ends (or "none — one-shot")
- **Interruption:** what happens if retriggered mid-animation
- **Spring defaults:** recommended `bounce` and `duration` values

## Reduced Motion

Describe the degraded experience when `prefers-reduced-motion: reduce` is set. Either: skip animation (apply final state instantly), simplify to a fade-only, or describe the alternative.

## Slots

| Slot | Description |
|------|-------------|
| (default) | What slotted content is expected |

## Docs Page

- **Preview demo:** describe what should appear in `<DocsPreview>` (HTML structure, placeholder content)
- **Variants shown:** list the different attribute combinations the docs page should showcase
- **Code example:** the minimal snippet a user copies to get started

## Acceptance Criteria

Checkbox list. Implementation is complete when ALL are checked:
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] ...

## Out of scope

List what this component explicitly does NOT do.

---

## Rules

- Write the PRD before touching any code.
- Every prop must have a clear default and a clear reason it's configurable.
- Acceptance criteria must be testable and specific — not "it works" but "hovering triggers the animation within 16ms".
- If a section cannot be filled in, flag it with `[NEEDS DECISION]` — don't invent answers.

## Next step

After the PRD is approved, pass it to the **`tasks`** skill (`.claude/skills/tasks/SKILL.md`) to decompose into actionable work items.

## References

- Requirements gathering: **`clarify`** skill (`.claude/skills/clarify/SKILL.md`)
- Issue breakdown: **`tasks`** skill (`.claude/skills/tasks/SKILL.md`)
- Style conventions: **`style-guide`** skill (`.claude/skills/style-guide/SKILL.md`)
