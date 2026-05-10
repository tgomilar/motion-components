# motion-components — agents & skills

This project uses **agents** (specialized domain experts) and **skills** (repeatable workflows) to guide development. All definitions live in `.claude/` — the directory used by Claude and compatible AI coding tools.

---

## Agents (`.claude/agents/`)

| Agent | File | Focus |
|-------|------|-------|
| Animation Expert | `.claude/agents/animation-expert.md` | Motion One API, spring physics, interrupt-safe animations |
| Lit Architect | `.claude/agents/lit-architect.md` | LitElement component design, clean APIs, reusability |
| Motion Architect | `.claude/agents/motion-architect.md` | Reusable animation architecture, primitives composition |
| UX Motion Reviewer | `.claude/agents/ux-motion-reviewer.md` | Animation quality, natural feel, speed, accessibility |

## Skills (`.claude/skills/`)

```
clarify → plan → tasks → new-component → [edits] → release
```

| Skill | When to use |
|-------|-------------|
| `clarify` | Component idea is vague — ask 10 clarifying questions |
| `plan` | Requirements are clear — formalize into a spec doc |
| `tasks` | PRD is approved — break into actionable work items |
| `spec-first` | Implementing spec-first — types contract before code |
| `new-component` | Scaffolding a new `motion-*` component |
| `style-guide` | Reference during any implementation |
| `audit` | Auditing for drift, duplication, violations |
| `release` | Before publishing a new version |

## npm scripts

| Script | Description |
|--------|-------------|
| `build` | Vite build + CEM analyze |
| `typecheck` | `tsc --noEmit` |
| `lint` / `lint:fix` | ESLint |
| `format` / `format:check` | Prettier |
| `generate-exports` | Regenerate `package.json` exports from `vite.config.ts` |
| `check:preload` | Validate FOUC preload rules |
| `size` | Bundle size budget check |
| `prepublishOnly` | Full release pipeline |
| `site:dev` / `site:build` | Docs site (Astro) |
