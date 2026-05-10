/** Observes `el` and calls `onEnter` each time it intersects the viewport. Returns a disconnect fn. */
export function useIntersect(el: Element, threshold: number, onEnter: () => void): () => void {
  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) onEnter()
    },
    { threshold },
  )
  io.observe(el)
  return () => io.disconnect()
}
