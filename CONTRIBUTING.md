# Contributing

## Project structure

```
src/
  reveal/          entrance & transition effects (reveal, stagger, blur, …)
  respond/         input-driven interactivity (hover, press, magnetic, tilt)
  text/            typography effects (split, typewriter, counter, …)
  scroll/          scroll-driven components (parallax, scene)
  components/      interactive widgets (slider, dialog, flip-card, …)
  code/            code-display components (motion-code, motion-code-inline)
  utils/           shared animation & playback utilities
```

Each component lives in its own directory: `src/<category>/motion-<name>/motion-<name>.ts` with a co-located `motion-<name>.types.ts`.

## Adding a new component

1. **Define the types** — create `<tag>.types.ts` with the props interface matching every `@property`
2. **Implement** — create `<tag>.ts` with LitElement, `@customElement`, `@property` declarations, and Motion One animation
3. **Wire exports** — add to `src/index.ts`, then run `npm run generate-exports` to update `package.json` exports and `vite.config.ts` entries
4. **Create docs** — add `site/src/pages/docs/<category>/<tag>.astro`
5. **Typecheck** — `npx tsc --noEmit`

## Conventions

- Spring physics over easing curves (`{ type: 'spring', duration, bounce }`)
- No CSS `@keyframes` — all animation through Motion (ex MotionOne)
- Check `prefers-reduced-motion: reduce` before every animation call
- No inline `//` comments — CEM JSDoc only for public API
- kebab-case attributes, PascalCase classes, `motion-*` tag names

## npm scripts

```sh
npm run build           # build library
npm run typecheck       # tsc --noEmit
npm run lint            # eslint
npm run format          # prettier
npm run generate-exports # sync package.json exports with vite config
npm run check:preload   # validate FOUC prevention rules
npm run size            # bundle size check
npm run site:dev        # docs site dev server
```

See `AGENTS.md` for AI-assisted development workflows using `.claude/` skills.
