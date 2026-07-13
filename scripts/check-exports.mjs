#!/usr/bin/env node
/**
 * Verifies that every path declared in package.json "exports" resolves to an
 * actual file in dist/, and that every re-export in src/index.ts has a
 * corresponding subpath export in package.json.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'))
const indexSrc = readFileSync(resolve(ROOT, 'src/index.ts'), 'utf8')

let exitCode = 0
const log = (...a) => console.log(...a)

// ── 1. Every dist file referenced in exports must exist ──────────────────────
const missingFiles = []

for (const [subpath, cond] of Object.entries(pkg.exports)) {
  const entries = typeof cond === 'string' ? [cond] : Object.values(cond)
  for (const rel of entries) {
    // Skip CSS assets that don't emit .d.ts
    if (rel.endsWith('.css')) continue
    const abs = resolve(ROOT, rel.replace(/^\.\//, ''))
    if (!existsSync(abs)) {
      missingFiles.push({ subpath, path: rel })
    }
  }
}

if (missingFiles.length) {
  exitCode = 1
  log('\nMISSING dist files (declared in package.json exports but not built):')
  for (const { subpath, path } of missingFiles) {
    log(`  - ${subpath}: ${path}`)
  }
}

// ── 2. Every component re-export in src/index.ts must have a subpath export ──
// Extract source module names from lines like: export { Foo } from './path/name.js'
// Only motion-* components get subpath exports; utils ship via the main entry.
const FROM_RE = /^export\s+\{[^}]+\}\s+from\s+['"]\.\/(.+?)\.js['"]/gm
const srcModules = new Set()
for (const m of indexSrc.matchAll(FROM_RE)) {
  // last segment of the path is the file name (= the subpath key)
  const segments = m[1].split('/')
  const mod = segments.at(-1)
  if (mod.startsWith('motion-')) srcModules.add(mod)
}

// Build a set of all subpath keys (strip leading "./" and skip "." / preload variants)
const exportedSubpaths = new Set(
  Object.keys(pkg.exports)
    .filter((k) => k !== '.' && k !== './preload' && k !== './preload.css')
    .map((k) => k.replace(/^\.\//, '')),
)

const notExported = []
for (const mod of srcModules) {
  if (mod === 'preload') continue
  if (!exportedSubpaths.has(mod)) {
    notExported.push(mod)
  }
}

if (notExported.length) {
  exitCode = 1
  log('\nMISSING subpath exports (re-exported in src/index.ts but not in package.json exports):')
  for (const mod of notExported) {
    log(`  - ./${mod}`)
  }
}

// ── 3. Every subpath export must also be in src/index.ts ────────────────────
const notInIndex = []
for (const sub of exportedSubpaths) {
  if (!srcModules.has(sub)) {
    notInIndex.push(sub)
  }
}

if (notInIndex.length) {
  log('\nPOSSIBLY STALE subpath exports (in package.json but no matching re-export in src/index.ts):')
  for (const sub of notInIndex) log(`  - ./${sub}`)
  // warning only — subpath-only components without an index re-export are allowed
}

if (exitCode === 0 && missingFiles.length === 0 && notExported.length === 0) {
  log('exports check: ok — all package.json export paths exist in dist and match src/index.ts.')
}

process.exit(exitCode)
