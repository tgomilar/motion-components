import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

const entries: Record<string, string> = {
  index: 'src/index.ts',
  preload: 'src/preload.ts',

  'motion-hover': 'src/respond/motion-hover/motion-hover.ts',
  'motion-press': 'src/respond/motion-press/motion-press.ts',
  'motion-magnetic': 'src/respond/motion-magnetic/motion-magnetic.ts',
  'motion-tilt': 'src/respond/motion-tilt/motion-tilt.ts',

  'motion-reveal': 'src/reveal/motion-reveal/motion-reveal.ts',
  'motion-stagger': 'src/reveal/motion-stagger/motion-stagger.ts',
  'motion-blur': 'src/reveal/motion-blur/motion-blur.ts',
  'motion-blur-in': 'src/reveal/motion-blur-in/motion-blur-in.ts',

  'motion-text-mask': 'src/text/motion-text-mask/motion-text-mask.ts',
  'motion-split': 'src/text/motion-split/motion-split.ts',
  'motion-headline': 'src/text/motion-headline/motion-headline.ts',
  'motion-glitch': 'src/text/motion-glitch/motion-glitch.ts',
  'motion-typewriter': 'src/text/motion-typewriter/motion-typewriter.ts',
  'motion-counter': 'src/text/motion-counter/motion-counter.ts',
  'motion-scramble': 'src/text/motion-scramble/motion-scramble.ts',
  'motion-ticker': 'src/text/motion-ticker/motion-ticker.ts',
  'motion-words': 'src/text/motion-words/motion-words.ts',
  'motion-curve': 'src/text/motion-curve/motion-curve.ts',
  'motion-circle': 'src/text/motion-circle/motion-circle.ts',
  'motion-arc': 'src/text/motion-arc/motion-arc.ts',
  'motion-perspective': 'src/text/motion-perspective/motion-perspective.ts',
  'motion-stretch': 'src/text/motion-stretch/motion-stretch.ts',
  'motion-liquid': 'src/text/motion-liquid/motion-liquid.ts',
  'motion-gravity': 'src/text/motion-gravity/motion-gravity.ts',
  'motion-font': 'src/text/motion-font/motion-font.ts',

  'motion-slider': 'src/components/motion-slider/motion-slider.ts',
  'motion-gallery': 'src/components/motion-gallery/motion-gallery.ts',
  'motion-countdown': 'src/components/motion-countdown/motion-countdown.ts',
  'motion-spotlight': 'src/components/motion-spotlight/motion-spotlight.ts',
  'motion-progress': 'src/components/motion-progress/motion-progress.ts',
  'motion-image-compare': 'src/components/motion-image-compare/motion-image-compare.ts',
  'motion-flip-card': 'src/components/motion-flip-card/motion-flip-card.ts',
  'motion-dialog': 'src/components/motion-dialog/motion-dialog.ts',

  'motion-parallax': 'src/scroll/motion-parallax/motion-parallax.ts',
  'motion-scene': 'src/scroll/motion-scene/motion-scene.ts',

  'code-window': 'src/code/code-window/code-window.ts',
  'code-inline': 'src/code/code-inline/code-inline.ts',
}

export default defineConfig({
  build: {
    lib: {
      entry: entries,
      formats: ['es'],
    },
    rollupOptions: {
      external: ['lit', 'motion', /^lit\//, /^motion\//],
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
  plugins: [
    dts({ entryRoot: 'src' }),
    {
      name: 'emit-preload-css',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'preload.css',
          source: readFileSync('src/preload.css', 'utf-8'),
        })
      },
    },
  ],
})
