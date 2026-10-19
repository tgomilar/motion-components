/** Observes `el` and calls `onEnter` when it scrolls into view, `onLeave` when it leaves. */
export function useIntersect(
  el: Element,
  threshold: number,
  onEnter: () => void,
  onLeave?: () => void,
): () => void {
  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) onEnter()
      else onLeave?.()
    },
    { threshold },
  )
  io.observe(el)
  return () => io.disconnect()
}
