import { afterEach } from 'vitest'
import { restoreGlobals } from './helpers.js'

// Every test starts from the real platform globals; stubs opt in per-case.
afterEach(() => {
  restoreGlobals()
})
