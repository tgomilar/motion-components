#!/usr/bin/env node
// Imports every built entry in Node, where browser globals are missing, so a
// component that touches `window` or `HTMLElement` at import time fails here
// instead of in a user's server-side render.
import { readdirSync } from 'node:fs'
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

if (failures.length) {
  console.error(`SSR import failed for ${failures.length} entr${failures.length === 1 ? 'y' : 'ies'}:`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}
console.log(`SSR import ok: ${entries.length} entries`)
