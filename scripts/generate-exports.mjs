#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const VITE_CONFIG = new URL('../vite.config.ts', import.meta.url)
const PKG_JSON = new URL('../package.json', import.meta.url)

const viteSrc = readFileSync(VITE_CONFIG, 'utf8')

const entryRe = /['"]([\w-]+)['"]\s*:\s*['](src\/[^']+)[']/g
const entries = []
for (let m; (m = entryRe.exec(viteSrc)); ) {
  entries.push({ name: m[1], source: m[2] })
}

const rootExports = {
  '.': {
    types: './dist/index.d.ts',
    import: './dist/index.js',
  },
  './preload': {
    types: './dist/preload.d.ts',
    import: './dist/preload.js',
  },
  './preload.css': './dist/preload.css',
}

const componentExports = {}
for (const { name, source } of entries) {
  if (name === 'index' || name === 'preload') continue
  const match = source.match(/src\/(.+?)\/motion-[\w-]+\//)
  const codeMatch = source.match(/src\/(.+?)\/code-[\w-]+\//)
  const cat = match ? match[1] : codeMatch ? codeMatch[1] : null

  if (cat) {
    componentExports[`./${name}`] = {
      types: `./dist/${cat}/${name}/${name}.d.ts`,
      import: `./dist/${name}.js`,
    }
  }
}

const sortedKeys = Object.keys(componentExports).sort()
const merged = { ...rootExports }
for (const k of sortedKeys) {
  merged[k] = componentExports[k]
}

const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8'))
pkg.exports = merged
writeFileSync(PKG_JSON, JSON.stringify(pkg, null, 2) + '\n')

console.log(`Regenerated exports for ${sortedKeys.length} components + ${Object.keys(rootExports).length} root entries.`)
