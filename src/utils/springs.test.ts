import { describe, it, expect } from 'vitest'
import { REVEAL_SPRING } from './springs.js'

describe('REVEAL_SPRING', () => {
  it('is a spring with a gentle bounce', () => {
    expect(REVEAL_SPRING).toEqual({ type: 'spring', bounce: 0.2 })
  })
})
