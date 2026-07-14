import { customElementVsCodePlugin } from 'custom-element-vs-code-integration'
import { customElementJetBrainsPlugin } from 'custom-element-jet-brains-integration'

export default {
  globs: ['src/**/*.ts'],
  exclude: ['src/**/*.types.ts', 'src/**/*.d.ts'],
  outdir: 'dist',
  litelement: true,
  packagejson: true,
  dev: false,
  plugins: [
    customElementVsCodePlugin({ outdir: 'dist' }),
    customElementJetBrainsPlugin({ outdir: 'dist' }),
  ],
}
