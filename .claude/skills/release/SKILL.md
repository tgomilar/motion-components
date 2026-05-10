---
name: release
description: Run pre-publish verification for the motion-components package — typecheck, preload-rule check, library build, and bundle size budget. Use before bumping the version or running npm publish.
---

# release

Sequence to run before publishing a new version of the `motion-components` npm package. The repo's `prepublishOnly` script chains most of this; running it manually surfaces failures earlier and keeps `dist/` in a known state.

## What `prepublishOnly` already runs

```bash
rm -rf dist && \
  npm run typecheck && \
  npm run check:preload && \
  npm run build && \
  npm run size
```

If any step fails, the publish is aborted. Don't bypass with `--ignore-scripts`.

## Manual sequence (use this for pre-flight, not for actually publishing)

1. **Working tree clean** — `git status` should be empty. Don't release from a dirty tree.
2. **Branch up to date** — `git fetch && git status -sb` should report `## main...origin/main` with no `[ahead/behind]`.
3. **Type-check the library:**
   ```bash
   npx tsc --noEmit
   ```
4. **Preload check** — `npm run check:preload`. The script in `scripts/check-preload.mjs` walks `src/preload.ts` and verifies every component that hides slotted content on entrance has a `:not(:defined)` rule. Fix mismatches by editing `src/preload.ts`'s `RULES` map.
5. **Build the library** — `npm run build`. Vite emits per-component `.js` entries plus `index.js`, `preload.js`, and `preload.css`. Confirm `dist/` contains an entry for every key in `vite.config.ts`'s `entries` map.
6. **Verify package.json exports match build outputs** — run `npm run generate-exports` to regenerate the exports map from `vite.config.ts` entries. Then verify:
   ```bash
   npm run generate-exports
   ls dist/*.js | sed 's|dist/||;s|\.js$||' | sort > /tmp/built.txt
   node -e "console.log(Object.keys(require('./package.json').exports).filter(k=>k.startsWith('./motion-')||k.startsWith('./code-')||k==='./preload').map(k=>k.replace('./','')).sort().join('\n'))" > /tmp/exported.txt
   diff /tmp/built.txt /tmp/exported.txt
   ```
7. **Bundle size budget** — `npm run size`. Compares brotli'd output against the budget in `package.json`. The library targets ~20 KB brotlied for the full bundle. If a single new component blows the budget, reconsider its weight (often: heavy import, missing externalisation).
8. **Version bump** — `npm version <patch|minor|major>`. This updates `package.json`, creates a tag, and a commit. Push with `git push --follow-tags`.
10. **Publish** — `npm publish`. Runs `prepublishOnly` again as a safety net.

## Things that are easy to forget

- **New components** need four touches in sync: `src/<cat>/<name>/<name>.ts`, the re-export in `src/index.ts`, the entry in `vite.config.ts`, and the export in `package.json`. The build will succeed without the export but consumers using `import 'motion-components/motion-foo'` will hit a "package subpath not defined" error.
- **Preload rules** only matter for components that hide slotted content during entrance (reveal, split, headline, ticker, slider, gallery, blur, blur-in, counter, glitch, scramble, typewriter, stagger). Hover/click/scroll-driven components don't need them.
- **Per-component types** — the `types` field in each `package.json` export points to the `.d.ts` *next to its source*, not at `dist/`'s root, so the dts plugin's directory layout matters.
- **Changelog** — there is no automated changelog. Write release notes by hand based on `git log <last-tag>..HEAD --oneline`.

## When something fails

- **`check:preload` fails:** a new component was added without a preload rule, or a removed component still has one. Edit `src/preload.ts`.
- **`size` over budget:** check the per-entry sizes in the build output. Heavy components (a 3-axis spring + heavy geometry) can blow the budget; offload to per-component imports if the goal is keeping the full-bundle small.

## When *not* to release

- The branch is dirty, behind `main`, or has unmerged conflicts.
- `dist/` was committed by accident — it's gitignored; don't pin it.
- A component was added but not exported in `package.json`. Run the diff in step 6.

## References

- Component implementation: **`new-component`** skill (`.claude/skills/new-component/SKILL.md`)
- Architecture audit: **`audit`** skill (`.claude/skills/audit/SKILL.md`)
- Style conventions: **`style-guide`** skill (`.claude/skills/style-guide/SKILL.md`)
