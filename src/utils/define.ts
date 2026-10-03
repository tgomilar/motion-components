/**
 * Registers a custom element once. A second registration of the same tag,
 * for example from two bundles that both include a component, is ignored
 * instead of throwing.
 */
export function defineElement(tag: string, element: CustomElementConstructor): void {
  if (typeof customElements === 'undefined') return
  if (!customElements.get(tag)) customElements.define(tag, element)
}

/** Class decorator form of {@link defineElement}. */
export const customElement =
  (tag: string) =>
  (element: CustomElementConstructor): void =>
    defineElement(tag, element)

/**
 * `HTMLElement` in the browser, and an empty class during server-side
 * rendering, so importing a component on the server does not throw.
 */
export const BaseElement: typeof HTMLElement =
  globalThis.HTMLElement ?? (class {} as unknown as typeof HTMLElement)
