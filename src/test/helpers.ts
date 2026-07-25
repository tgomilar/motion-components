/** Shared test stubs for the reduced-motion and IntersectionObserver seams. */

const originalMatchMedia = window.matchMedia
const originalIO = window.IntersectionObserver

/**
 * Force `window.matchMedia('(prefers-reduced-motion: reduce)')` to report
 * `reduce`. Components read this live on every gated call, so stubbing the
 * factory is enough — no need to reconstruct the element.
 */
export function stubReducedMotion(reduce: boolean): void {
  window.matchMedia = ((query: string) =>
    ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList) as typeof window.matchMedia
}

export interface IntersectionHandle {
  /** Fire `isIntersecting: true` for every currently-observed element. */
  enter(): void
  /** Fire `isIntersecting: false` for every currently-observed element. */
  leave(): void
  /** Elements observed across all live observer instances. */
  readonly observed: Element[]
}

interface FakeInstance {
  cb: IntersectionObserverCallback
  observed: Set<Element>
}

/**
 * Replace `IntersectionObserver` with a controllable fake. Returns a handle
 * that fires the observer callback on demand, so viewport triggering is
 * deterministic instead of dependent on real scroll/layout.
 */
export function stubIntersectionObserver(): IntersectionHandle {
  const instances: FakeInstance[] = []

  class FakeIntersectionObserver {
    private instance: FakeInstance
    constructor(cb: IntersectionObserverCallback) {
      this.instance = { cb, observed: new Set() }
      instances.push(this.instance)
    }
    observe(el: Element) {
      this.instance.observed.add(el)
    }
    unobserve(el: Element) {
      this.instance.observed.delete(el)
    }
    disconnect() {
      this.instance.observed.clear()
    }
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
    root = null
    rootMargin = ''
    thresholds = []
  }
  window.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver

  const fire = (isIntersecting: boolean) => {
    for (const inst of instances) {
      const entries = [...inst.observed].map(
        (target) => ({ target, isIntersecting }) as IntersectionObserverEntry,
      )
      if (entries.length) inst.cb(entries, inst as unknown as IntersectionObserver)
    }
  }

  return {
    enter: () => fire(true),
    leave: () => fire(false),
    get observed() {
      return instances.flatMap((i) => [...i.observed])
    },
  }
}

/** Resolve on the next dispatch of `name` from `el`. */
export function waitForEvent(el: EventTarget, name: string): Promise<Event> {
  return new Promise((resolve) => el.addEventListener(name, resolve, { once: true }))
}

/** Restore any globals patched by the stubs above. Called from setup afterEach. */
export function restoreGlobals(): void {
  window.matchMedia = originalMatchMedia
  window.IntersectionObserver = originalIO
}
