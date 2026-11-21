/** "1 purchase", "3 purchases". */
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
