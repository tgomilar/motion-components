<p>
  <img src="https://img.shields.io/npm/v/motion-components" alt="npm">
  <img src="https://img.shields.io/bundlephobia/minzip/motion-components" alt="size">
</p>

# motion-components

**Drop-in web components with spring-physics animations. Works in any framework - or no framework at all.**

Architected with animation as a core concern from day one - not bolted on as an afterthought. Every component leverages spring physics, interruptible animations, and composable primitives to deliver interactions that feel natural and responsive.

▸ Reveal elements on scroll  ▸ Hover/press/tilt responses  ▸ Character-by-character text effects  ▸ Parallax & scroll scenes  ▸ Sliders, dialogs, image comparisons & more

**[👉 Docs & Live Preview](https://www.motion-components.dev)**

Built with [Motion](https://motion.dev/) and [Lit](https://lit.dev/). Full TypeScript types included.

---

## Quick start

**1. Install**

```sh
npm install motion-components
```

**2. Import & use**

```js
// Import all components
import 'motion-components'

// Import separate components (tree shakable)
import 'motion-components/motion-reveal'
import 'motion-components/motion-hover'
import 'motion-components/motion-stagger'

// Prevent content flash before animations run
import 'motion-components/preload.css'
```

```html
<motion-reveal>
  <h1>Animates in when scrolled into view</h1>
</motion-reveal>

<motion-hover scale="1.05">
  <button>Hover me</button>
</motion-hover>

<motion-stagger interval="0.06">
  <p>First child</p>
  <p>Second child</p>
  <p>Third child</p>
</motion-stagger>
```

### CDN - no build step

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/motion-components/dist/index.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/motion-components/dist/preload.css" />

<motion-reveal>
  <h1>Animates in when scrolled into view</h1>
</motion-reveal>
```

---

## Framework setup

| Framework                        | Config needed?                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Astro, Svelte, Solid, Preact** | None                                                                                              |
| **React**                        | Use React 19+ (native web component support). React 18 has limited support - upgrade if possible. |
| **Vue 3**                        | Tell the compiler to treat `motion-*` as custom elements                                          |
| **Angular**                      | Add `CUSTOM_ELEMENTS_SCHEMA`                                                                      |
| **Plain HTML**                   | Use the CDN script tag above                                                                      |

<details>
<summary>Vue 3 config</summary>

```js
// vite.config.js
vue({
  template: {
    compilerOptions: {
      isCustomElement: (tag) => tag.startsWith('motion-'),
    },
  },
})
```

</details>

<details>
<summary>Angular config</summary>

```ts
import { CUSTOM_ELEMENTS_SCHEMA, Component } from '@angular/core'

@Component({
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class MyComponent {}
```

</details>

---

## Components

### Reveal [🔗](https://www.motion-components.dev/docs/reveal/motion-reveal/)

Entrance & transition effects

[`motion-reveal`](https://www.motion-components.dev/docs/reveal/motion-reveal/) [`motion-stagger`](https://www.motion-components.dev/docs/reveal/motion-stagger/) [`motion-blur`](https://www.motion-components.dev/docs/reveal/motion-blur/) [`motion-blur-in`](https://www.motion-components.dev/docs/reveal/motion-blur-in/)

### Respond [🔗](https://www.motion-components.dev/docs/respond/motion-hover/)

Input-driven interactivity

[`motion-hover`](https://www.motion-components.dev/docs/respond/motion-hover/) [`motion-press`](https://www.motion-components.dev/docs/respond/motion-press/) [`motion-magnetic`](https://www.motion-components.dev/docs/respond/motion-magnetic/) [`motion-tilt`](https://www.motion-components.dev/docs/respond/motion-tilt/)

### Text [🔗](https://www.motion-components.dev/docs/text/motion-split/)

Typography & character effects

[`motion-split`](https://www.motion-components.dev/docs/text/motion-split/) [`motion-typewriter`](https://www.motion-components.dev/docs/text/motion-typewriter/) [`motion-counter`](https://www.motion-components.dev/docs/text/motion-counter/) [`motion-scramble`](https://www.motion-components.dev/docs/text/motion-scramble/)
[`motion-ticker`](https://www.motion-components.dev/docs/text/motion-ticker/) [`motion-words`](https://www.motion-components.dev/docs/text/motion-words/) [`motion-curve`](https://www.motion-components.dev/docs/text/motion-curve/) [`motion-circle`](https://www.motion-components.dev/docs/text/motion-circle/)
[`motion-arc`](https://www.motion-components.dev/docs/text/motion-arc/) [`motion-headline`](https://www.motion-components.dev/docs/text/motion-headline/) [`motion-glitch`](https://www.motion-components.dev/docs/text/motion-glitch/) [`motion-gravity`](https://www.motion-components.dev/docs/text/motion-gravity/)
[`motion-liquid`](https://www.motion-components.dev/docs/text/motion-liquid/) [`motion-perspective`](https://www.motion-components.dev/docs/text/motion-perspective/) [`motion-stretch`](https://www.motion-components.dev/docs/text/motion-stretch/) [`motion-swap`](https://www.motion-components.dev/docs/text/motion-swap/)
[`motion-text-mask`](https://www.motion-components.dev/docs/text/motion-text-mask/) [`motion-font`](https://www.motion-components.dev/docs/text/motion-font/)

### Scroll [🔗](https://www.motion-components.dev/docs/scroll/motion-parallax/)

Scroll-driven animation

[`motion-parallax`](https://www.motion-components.dev/docs/scroll/motion-parallax/) [`motion-scene`](https://www.motion-components.dev/docs/scroll/motion-scene/)

### Components [🔗](https://www.motion-components.dev/docs/components/motion-slider/)

Ready-made interactive components

[`motion-slider`](https://www.motion-components.dev/docs/components/motion-slider/) [`motion-gallery`](https://www.motion-components.dev/docs/components/motion-gallery/) [`motion-dialog`](https://www.motion-components.dev/docs/components/motion-dialog/) [`motion-countdown`](https://www.motion-components.dev/docs/components/motion-countdown/)
[`motion-spotlight`](https://www.motion-components.dev/docs/components/motion-spotlight/) [`motion-progress`](https://www.motion-components.dev/docs/components/motion-progress/) [`motion-image-compare`](https://www.motion-components.dev/docs/components/motion-image-compare/) [`motion-flip-card`](https://www.motion-components.dev/docs/components/motion-flip-card/)

### Code [🔗](https://www.motion-components.dev/docs/code/motion-code/)

Syntax-highlighted code display

[`motion-code`](https://www.motion-components.dev/docs/code/motion-code/) [`motion-code-inline`](https://www.motion-components.dev/docs/code/motion-code-inline/)

> **Import note:** `motion-code` lives at `motion-components/code-window` and `motion-code-inline` at `motion-components/code-inline`. The subpath names differ from the tag names.

---

## Flash prevention (FOUC)

Web components upgrade asynchronously, so content can flash before animations are ready. Choose your prevention method:

### Static stylesheet

```js
import 'motion-components/preload.css'
```

### CDN link

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/motion-components/dist/preload.css" />
```

### Programmatic

```js
import { preload } from 'motion-components'
preload(['motion-reveal', 'motion-split', 'motion-dialog'])
```

Call `preload()` with no arguments to cover all preload-registered components.

### Raw CSS string (for Astro, Svelte, etc.)

```js
import { preloadCSS } from 'motion-components'
// inject preloadCSS into your framework's <head> mechanism
```

**Which components need preloading?** Only those that hide content on initialization - reveal, text, stagger, dialog, and a few widgets. The build validates preload entries automatically via `npm run check:preload`.

---

## Why motion-components?

- **Motion-first.** Built around animation from the start, not retrofitted.
- **Spring physics by default.** No linear easing, no jank.
- **Interruptible.** Interactions never queue or stutter - even mid-animation.
- **Per-component imports.** Each component is a standalone subpath export - no dead weight, no bundler magic required.
- **Composable.** Shared primitives instead of reimplemented animations.
- **Accessible.** Honors `prefers-reduced-motion`. Keyboard-navigable.

---

## Development

```sh
npm install          # install dependencies
npm run build        # build library to ./dist
npm run dev          # rebuild on file change
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run format       # Prettier
npm run check:preload # validate FOUC preload rules
npm run size         # bundle size budget check
```

### Repo layout

```
src/
├── reveal/      entrance & transition effects
├── respond/     input-driven interactivity
├── text/        typography effects
├── scroll/      scroll-driven components
├── components/  ready-made widgets
└── code/        code-display components
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for component authoring conventions.

---

## Documentation

[www.motion-components.dev](https://www.motion-components.dev)

---

## Showcase

[Showcase 🔗](https://www.motion-components.dev/showcase/) · [Parallax 🔗](https://www.motion-components.dev/showcase/parallax/) · [Scene 🔗](https://www.motion-components.dev/showcase/scene/) · [Motion Font 🔗](https://www.motion-components.dev/showcase/motion-font/)

---

## License

MIT © [Tanja Gomilar](https://github.com/tgomilar)
