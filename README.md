# motion-components

Web components with spring physics animations. Drop into any HTML page or framework — no rewrites.

Built around motion from the start, not retrofitted with it. Every component uses spring physics, interruptible animations, and composable primitives so interactions feel natural, never janky.

Organized by **user intent**: reveal elements on scroll, respond to hover/press/tilt, animate text character-by-character, drive parallax effects, or drop in ready-made widgets like sliders, dialogs, and image comparisons.

Built with [Motion](https://motion.dev/) (animation engine) and [Lit](https://lit.dev/) (web components). Full TypeScript types included.

## Install

```sh
npm install motion-components
```

Or via CDN — no build step required:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/motion-components/dist/index.js"></script>
```

## Components

### Reveal

Entrance and transition effects:

`motion-reveal` · `motion-stagger` · `motion-blur` · `motion-blur-in`

### Respond

Input-driven interactivity:

`motion-hover` · `motion-press` · `motion-magnetic` · `motion-tilt`

### Text

`motion-split` · `motion-typewriter` · `motion-counter` · `motion-scramble` · `motion-ticker` · `motion-words` · `motion-curve` · `motion-circle` · `motion-arc` · `motion-headline` · `motion-glitch` · `motion-gravity` · `motion-liquid` · `motion-perspective` · `motion-stretch` · `motion-text-mask` · `motion-font`

### Scroll

`motion-parallax` · `motion-scene`

### Components

Ready-to-use interactive widgets:

`motion-slider` · `motion-gallery` · `motion-dialog` · `motion-countdown` · `motion-spotlight` · `motion-progress` · `motion-image-compare` · `motion-flip-card`

### Code

Syntax-highlighted code display:

`motion-code` · `motion-code-inline`

**Note:** Import as `motion-components/code-window` (for `<motion-code>`) and `motion-components/code-inline` (for `<motion-code-inline>`). The subpath names differ from the tag names.

## Usage

Import only the components you need (recommended — keeps bundles small):

```js
import "motion-components/motion-reveal";
import "motion-components/motion-hover";
import "motion-components/motion-stagger";
```

Or import the whole library to register every component at once:

```js
import "motion-components";
```

```html
<motion-reveal>
  <h1>Animates in when scrolled into view</h1>
</motion-reveal>

<motion-hover scale="1.05">
  <button>Hover me</button>
</motion-hover>

<motion-stagger interval="0.06">
  <p>Staggered</p>
  <p>Children</p>
  <p>On entry</p>
</motion-stagger>
```

## Flash prevention (FOUC)

Web components upgrade asynchronously, so slotted content can flash before animations run. Add one of the following to prevent this.

### Static stylesheet

Import the preload CSS once to hide all preload-registered components until defined:

```js
import "motion-components/preload.css";
```

Or link via CDN:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/motion-components/dist/preload.css" />
```

### Programmatic API

For granular control — only hide specific tags, or inject rules dynamically:

```js
import { preload } from "motion-components";

preload(["motion-reveal", "motion-split", "motion-dialog"]);
```

Call `preload()` with no arguments to cover all preload-registered components (a curated subset that hide content on initialization).

### CSS string

Some frameworks (Astro, Svelte, etc.) handle stylesheets differently. Use the raw CSS string directly:

```js
import { preloadCSS } from "motion-components";
// inject preloadCSS into your framework's <head> mechanism
```

**Which components need preloading?** Only components that hide their content on initialization — primarily reveal, text, stagger, dialog, and a few interactive widgets. The build automatically validates preload entries against component source via `npm run check:preload`.

## Framework setup

Most frameworks need no configuration. Exceptions:

**React** — React 19+ works out of the box. React 18 has limited custom-element support; upgrade to React 19 if possible.

**Vue 3** — tell the compiler to treat `motion-*` tags as custom elements:

```js
// vite.config.js
vue({
  template: {
    compilerOptions: {
      isCustomElement: (tag) => tag.startsWith("motion-"),
    },
  },
});
```

**Angular** — add `CUSTOM_ELEMENTS_SCHEMA` to the component or module where you use `motion-*` tags:

```ts
import { CUSTOM_ELEMENTS_SCHEMA, Component } from "@angular/core";

@Component({
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  // ...
})
export class MyComponent {}
```

**Astro, Svelte, Solid** — no configuration needed.

## Philosophy

- **Motion-first.** Every component is built around the animation, not retrofitted with one.
- **Spring physics by default.** No linear easing, no jank.
- **Interruptible.** Interactions never queue or stutter.
- **Composable.** Components compose primitives instead of reimplementing animations.
- **Accessible.** Honors `prefers-reduced-motion` where it matters.

## Development

```sh
npm install
npm run build           # build library to ./dist
npm run dev             # rebuild on file change
npm run typecheck       # tsc --noEmit
npm run lint            # ESLint
npm run format          # Prettier
npm run check:preload   # validate FOUC preload rules
npm run size            # bundle size budget check
```

The repo layout:

- `src/reveal/` — entrance & transition effects (`motion-reveal`, `motion-stagger`, …)
- `src/respond/` — input-driven interactivity (`motion-hover`, `motion-press`, …)
- `src/text/` — text effect components
- `src/scroll/` — scroll-driven components
- `src/components/` — ready-to-use interactive widgets
- `src/code/` — code-display components

See [CONTRIBUTING.md](CONTRIBUTING.md) for component authoring conventions.

## License

MIT © [Tanja Gomilar](https://github.com/tgomilar)
