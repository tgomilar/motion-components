#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')
const PRELOAD_TS = join(SRC, 'preload.ts')
const PRELOAD_CSS = join(SRC, 'preload.css')

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const s = statSync(p)
    if (s.isDirectory()) out.push(...walk(p))
    else if (entry.endsWith('.ts') && !entry.endsWith('.types.ts') && entry !== 'preload.ts' && entry !== 'index.ts') out.push(p)
  }
  return out
}

const TAG_RE_DECORATOR = /@customElement\(\s*['"`]([^'"`]+)['"`]\s*\)/
const TAG_RE_DEFINE = /customElements\.define\(\s*['"`]([^'"`]+)['"`]/
function getTag(src) {
  return src.match(TAG_RE_DECORATOR)?.[1] ?? src.match(TAG_RE_DEFINE)?.[1] ?? null
}
const HOST_OPACITY_RE = /this\.style\.opacity\s*=\s*['"]0['"]/
const NOT_DEFINED_RE = /:not\(:defined\)/
const INLINE_OPACITY_RE = /opacity\s*:\s*0\b/
const ANIMATE_PRIVATE_OPACITY_RE = /animate\(\s*this\._\w+\s*,\s*\{\s*[^}]*opacity\s*:\s*0/
const CHILD_HIDE_RE = /(?:Array\.from\(this\.children\)|this\.children\b)[^;]*\.opacity\s*=\s*['"]0['"]|child\.style\.opacity\s*=\s*['"]0['"]/s
const STRUCTURAL_STYLE_RE = /Object\.assign\s*\(\s*this\.style\s*,\s*\{[^}]*(?:overflow|position|display)\s*:/s
const HOST_VISIBILITY_RE = /visibility\s*:\s*hidden/
// Explicit opt-in: // @preload host  or  // @preload children  or  // @preload (defaults to host)
const PRELOAD_ANNOTATION_RE = /\/\/\s*@preload(?:\s+(host|children))?/

function detect(file) {
  const src = readFileSync(file, 'utf8')
  const tag = getTag(src)
  if (!tag) return null

  const reasons = []
  let needsHost = false
  let needsChildren = false

  if (HOST_OPACITY_RE.test(src)) { needsHost = true; reasons.push('this.style.opacity = "0"') }
  if (NOT_DEFINED_RE.test(src)) { needsHost = true; reasons.push(':not(:defined) self-rule') }
  if (ANIMATE_PRIVATE_OPACITY_RE.test(src)) { needsHost = true; reasons.push('animate(this._x, { opacity: 0 })') }
  if (INLINE_OPACITY_RE.test(src) && /<span[^>]*opacity\s*:\s*0/.test(src)) { needsHost = true; reasons.push('inline opacity:0 in template') }
  if (STRUCTURAL_STYLE_RE.test(src)) { needsHost = true; reasons.push('structural styles set on host (display/position/overflow)') }
  if (HOST_VISIBILITY_RE.test(src)) { needsHost = true; reasons.push('visibility:hidden in static styles') }
  if (CHILD_HIDE_RE.test(src)) { needsChildren = true; reasons.push('children opacity = "0" in lifecycle') }

  const annotation = src.match(PRELOAD_ANNOTATION_RE)
  if (annotation) {
    const variant = annotation[1] ?? 'host'
    if (variant === 'children') { needsChildren = true; reasons.push('@preload children (explicit)') }
    else { needsHost = true; reasons.push('@preload host (explicit)') }
  }

  return { tag, file, needsHost, needsChildren, reasons }
}

function parsePreloadTs() {
  const src = readFileSync(PRELOAD_TS, 'utf8')
  const out = new Map()
  for (const m of src.matchAll(/['"]([\w-]+)['"]\s*:\s*['"]([^'"]+)['"]/g)) {
    out.set(m[1], m[2])
  }
  return out
}

function parsePreloadCss() {
  const src = readFileSync(PRELOAD_CSS, 'utf8')
  const out = new Map()
  // Each rule body is `tag:not(:defined)` or `tag:not(:defined) > *`
  for (const m of src.matchAll(/([\w-]+):not\(:defined\)(\s*>\s*\*)?/g)) {
    out.set(m[1], m[2] ? 'children' : 'host')
  }
  return out
}

const files = walk(SRC)
const detections = files.map(detect).filter(Boolean)
const preloadTs = parsePreloadTs()
const preloadCss = parsePreloadCss()

const missing = []
const stale = []
const wrongVariant = []

for (const d of detections) {
  if (!d.needsHost && !d.needsChildren) continue
  const want = d.needsChildren ? 'children' : 'host'
  const inTs = preloadTs.has(d.tag)
  const inCss = preloadCss.has(d.tag)
  if (!inTs || !inCss) {
    missing.push({ ...d, want, missingFrom: [!inTs && 'preload.ts', !inCss && 'preload.css'].filter(Boolean) })
    continue
  }
  // Validate variant
  const tsRule = preloadTs.get(d.tag)
  const tsVariant = />\s*\*/.test(tsRule) ? 'children' : 'host'
  if (tsVariant !== want || preloadCss.get(d.tag) !== want) {
    wrongVariant.push({ ...d, want, found: tsVariant })
  }
}

const detectedTags = new Set(detections.filter(d => d.needsHost || d.needsChildren).map(d => d.tag))
for (const tag of preloadTs.keys()) if (!detectedTags.has(tag)) stale.push(tag)
for (const tag of preloadCss.keys()) if (!detectedTags.has(tag) && !stale.includes(tag)) stale.push(tag)

let exitCode = 0
const log = (...a) => console.log(...a)

if (missing.length === 0 && wrongVariant.length === 0 && stale.length === 0) {
  log('preload check: ok — preload.ts and preload.css match detected FOUC patterns.')
  process.exit(0)
}

if (missing.length) {
  exitCode = 1
  log('\nMISSING from preload (component hides itself/children but is not in preload list):')
  for (const m of missing) {
    log(`  - ${m.tag} (${m.want})  — ${relative(ROOT, m.file)}`)
    log(`      reasons: ${m.reasons.join('; ')}`)
    log(`      missing from: ${m.missingFrom.join(', ')}`)
  }
}

if (wrongVariant.length) {
  exitCode = 1
  log('\nWRONG VARIANT (preload entry exists but uses host vs children incorrectly):')
  for (const w of wrongVariant) {
    log(`  - ${w.tag}: expected ${w.want}, found ${w.found}`)
  }
}

if (stale.length) {
  log('\nPOSSIBLY STALE entries in preload (no FOUC pattern detected in source — may be intentional, review):')
  for (const tag of stale) log(`  - ${tag}`)
}

process.exit(exitCode)
