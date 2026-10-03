import { describe, it, expect } from 'vitest'
import { defineElement } from './define.js'

describe('defineElement', () => {
  it('ignores a second registration of the same tag', () => {
    class First extends HTMLElement {}
    class Second extends HTMLElement {}
    defineElement('motion-define-test', First)
    expect(() => defineElement('motion-define-test', Second)).not.toThrow()
    expect(customElements.get('motion-define-test')).toBe(First)
  })
})
