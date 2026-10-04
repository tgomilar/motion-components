/** Splits a word after each hyphen, the only places a line may break inside a word. */
export const wordParts = (word: string) => word.split(/(?<=-)/)
