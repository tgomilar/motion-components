import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

// Standalone test config — deliberately does NOT reuse vite.config.ts, whose
// `lib` build + dts plugin are for producing dist artifacts, not for running
// tests. Components import `lit` / `motion` from node_modules as usual.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
  },
})
