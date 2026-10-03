#!/usr/bin/env node
// Imports every built entry in Node, where browser globals are missing, so a
// component that touches `window` or `HTMLElement` at import time fails here
// instead of in a user's server-side render. Where Node can require() ES
// modules, it also requires every package export, so CommonJS users keep working.
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join } from 'node:path'

const DIST = fileURLToPath(new URL('../dist', import.meta.url))
const entries = readdirSync(DIST).filter((f) => f.endsWith('.js'))
const failures = []

for (const file of entries) {
  try {
    await import(pathToFileURL(join(DIST, file)).href)
  } catch (error) {
    failures.push(`${file}: ${error.message}`)
  }
}

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const scripts = Object.keys(pkg.exports).filter((key) => !key.endsWith('.css'))
if (process.features.require_module) {
  const require = createRequire(import.meta.url)
  for (const key of scripts) {
    const specifier = key === '.' ? pkg.name : `${pkg.name}/${key.slice(2)}`
    try {
      require(specifier)
    } catch (error) {
      failures.push(`require('${specifier}'): ${error.code ?? error.message}`)
    }
  }
}

if (failures.length) {
  console.error(`SSR import failed for ${failures.length} entr${failures.length === 1 ? 'y' : 'ies'}:`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}
console.log(
  `SSR import ok: ${entries.length} entries` +
    (process.features.require_module ? `, require() ok: ${scripts.length} exports` : ''),
)
