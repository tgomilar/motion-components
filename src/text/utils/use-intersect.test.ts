import { describe, it, expect, vi, afterEach } from 'vitest'
import { useIntersect } from './use-intersect.js'
import { stubIntersectionObserver } from '../../test/helpers.js'

afterEach(() => {
  document.body.replaceChildren()
})

describe('useIntersect', () => {
  it('fires onEnter when the element intersects, not when it leaves', () => {
    const io = stubIntersectionObserver()
    const el = document.createElement('div')
    document.body.appendChild(el)
    const onEnter = vi.fn()

    useIntersect(el, 0.5, onEnter)
    expect(onEnter).not.toHaveBeenCalled()

    io.leave()
    expect(onEnter).not.toHaveBeenCalled()

    io.enter()
    expect(onEnter).toHaveBeenCalledOnce()
  })

  it('the returned disconnect stops further callbacks', () => {
    const io = stubIntersectionObserver()
    const el = document.createElement('div')
    document.body.appendChild(el)
    const onEnter = vi.fn()

    const disconnect = useIntersect(el, 0, onEnter)
    disconnect()
    io.enter()
    expect(onEnter).not.toHaveBeenCalled()
  })
})
