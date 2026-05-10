---
name: spec-first
description: Spec-first development loop for motion components — define the types contract and observable behavior before writing any implementation code, then implement to match the spec. Prevents drift between intent and code.
---

# spec-first

This project has no test framework. Instead, enforce a **spec-first loop**: define the complete contract (types, props, observable behavior) before writing a single line of animation or rendering code. Implementation must satisfy the spec, not the reverse. The loop is: **red → green → refactor**.

## The loop

### Red — define the contract first

Before any implementation:

1. **Write `<tag>.types.ts`** — every prop, its type, and its default value. If a type can't be expressed clearly, the design is incomplete. Fix that first.
2. **Write the docs page stub** — create the Astro docs page with the `<PropsTable>` filled in for every attribute. The table IS the spec. If a prop is ambiguous to document, it's ambiguous to implement.
3. **Write the JSDoc on the class** — `@element`, `@slot`, `@example`. This is the public contract. It must be complete before `render()` is written.

"Red" = the component doesn't exist yet, so any attempt to use it would fail.

### Green — implement to satisfy the spec

4. **Create `<tag>.ts`** with the skeleton: `@property` declarations matching the types file exactly, `static styles`, and an empty `render()`.
5. **Implement the animation** using Motion One. Every prop in the types file must be wired to the animation. No extra props, no missing props.
6. **Check props match docs** — compare `<PropsTable>` attributes against `@property` declarations. Every discrepancy is a bug.
7. **Run `npx tsc --noEmit`** — zero errors required. This is your "green" gate.

"Green" = the component exists and matches the spec.

### Refactor — clean up without breaking the contract

8. **Simplify animation code** — extract repeated `animate()` calls, consolidate spring params into a getter, remove dead branches.
9. **Verify reduced-motion** — check the `prefers-reduced-motion` branch applies the final state instantly and doesn't skip accessibility affordances.
10. **Re-run typecheck** — still zero errors.

"Refactor" = same observable behavior, cleaner code.

## Rules

- Never write `<tag>.ts` before `<tag>.types.ts` exists and is complete.
- Never merge props into the types file after implementation starts — that's the spec drifting to match the code. Stop, update the docs table instead, then update types, then update code.
- If a prop is "nice to have" but not in the PRD, it doesn't go in the types file. Add it in a follow-up cycle.
- The `<PropsTable>` on the docs page is the living spec. It must match the types file exactly at all times.

## Quick checklist

Before calling any issue "done", verify:

- [ ] `<tag>.types.ts` matches every `@property` in `<tag>.ts`
- [ ] `<PropsTable>` lists every attribute with correct type and default
- [ ] JSDoc `@example` is a working snippet
- [ ] `prefers-reduced-motion` branch exists and is tested manually
- [ ] `npx tsc --noEmit` exits 0

## References

- Implementation scaffolding: **`new-component`** skill (`.claude/skills/new-component/SKILL.md`)
- Style conventions: **`style-guide`** skill (`.claude/skills/style-guide/SKILL.md`)
- Release gate: **`release`** skill (`.claude/skills/release/SKILL.md`)
