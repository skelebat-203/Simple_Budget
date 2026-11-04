/** Message shown (banner and live region) when Charity purchases move to Miscellaneous (0009 §6). */
export const charityMovedText = (count: number) =>
  `${count === 1 ? 'Your Charity purchase moved' : `Your ${count} Charity purchases moved`} to Charity › Miscellaneous. Charity now totals its items.`
