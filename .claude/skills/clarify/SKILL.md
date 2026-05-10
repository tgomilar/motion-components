---
name: clarify
description: Ask focused clarifying questions before building any new component or feature. Forces shared understanding of animation behavior, props API, trigger conditions, accessibility, and done criteria BEFORE writing any code.
---

# clarify

Before writing a single line of code, ask the user a focused set of questions to reach shared understanding. Do NOT skip to implementation. The goal is to surface every assumption about animation behavior, props, triggers, and design intent so the result matches exactly what was intended.

## When to use

- The user describes a new component vaguely ("add a motion-X", "I want something that animates Y")
- The requirements are incomplete or ambiguous
- The user hasn't specified how the animation should feel (spring, duration, trigger)
- Multiple valid interpretations exist

## How to run

Ask ALL of the following questions in ONE message (numbered list, no preamble). Wait for answers before doing anything else.

### Questions to ask

1. **What does it animate?** Describe the visual transformation — what moves, fades, scales, or changes?
2. **What triggers the animation?** (mount/first paint, scroll into view, hover, click, a prop change, external event?)
3. **Is it reversible?** Does it animate back when the trigger ends, or is it one-shot?
4. **What are the props/attributes?** List every knob the user should be able to control (speed, intensity, direction, color, etc.).
5. **What are the default values?** For each prop, what should it do out of the box with zero configuration?
6. **Which animation primitive should compose it?** (`<motion-reveal>`, `<motion-hover>`, `<motion-press>`, `<motion-stagger>`, or none — novel widget?)
7. **What category does it belong to?** (`primitives`, `text`, `scroll`, `interaction`) — and why?
8. **What does the slotted content look like in the docs preview?** Describe the demo that should appear on the docs page.
9. **Accessibility: what happens with `prefers-reduced-motion`?** Skip entirely, apply final state instantly, or degrade to a simpler transition?
10. **What is "done"?** List the exact acceptance criteria — what must be true before this is considered complete?

## Rules

- Ask everything in one message. Don't drip questions one at a time.
- Do not start implementing until the user has answered all 10 questions (or explicitly said "just use your best judgment" for a specific one).
- If the user's answers reveal a conflict or gap, ask one targeted follow-up before proceeding.
- Summarize your understanding back to the user in a single paragraph after they answer, then wait for confirmation.

## Next step

After answers are confirmed, pass the result to the **`plan`** skill (`.claude/skills/plan/SKILL.md`) to formalize into a Product Requirements Document before any implementation begins.

## References

- Style conventions: **`style-guide`** skill (`.claude/skills/style-guide/SKILL.md`)
- PRD formalization: **`plan`** skill (`.claude/skills/plan/SKILL.md`)
