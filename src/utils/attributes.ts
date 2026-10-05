import type { ComplexAttributeConverter } from 'lit'

/** Reads a boolean attribute value, where a present attribute means `true` unless it is `"false"`. */
export const parseFlag = (value: string | null) => value !== null && value !== 'false'

/**
 * Boolean attribute converter where `attr="false"` means false. Plain Lit
 * booleans treat any present attribute as true, so a flag that defaults to
 * `true` could never be turned off from HTML. Use as
 * `@property({ type: Boolean, converter: flag })`.
 */
export const flag: ComplexAttributeConverter<boolean> = {
  fromAttribute: parseFlag,
  toAttribute: (value: boolean) => (value ? '' : null),
}

/** Reads a boolean attribute on an element that is not a LitElement. */
export function readFlag(element: Element, name: string, fallback: boolean): boolean {
  return element.hasAttribute(name) ? parseFlag(element.getAttribute(name)) : fallback
}
