/**
 * The Polish plural form for a count: 1 danie, 2 dania, 5 dań, 22 dania,
 * 12 dań. The panel is Polish-only, so this stays out of i18next.
 */
export function plPlural(count: number, one: string, few: string, many: string): string {
  const n = Math.abs(count);
  if (n === 1) return one;
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

/** `plPlural` with the count in front: "3 dania". */
export function plCount(count: number, one: string, few: string, many: string): string {
  return `${count} ${plPlural(count, one, few, many)}`;
}
