import { createContext } from 'react';

/*
 * How a menu writes its prices: in the restaurant's currency, the way its
 * country and its menu's language write money — "24,90 zł", "₺250,00",
 * "€12.50" — the same for every guest, as on a printed menu. Provided once
 * per menu (PriceFormatProvider) and read with usePriceFormat().
 */

export interface PriceFormat {
  format: (value: number) => string;
  /** The currency's sign as the prices write it, for a price field. */
  symbol: string;
}

export function priceFormat(
  currency = 'PLN',
  country = 'PL',
  language = 'pl',
): PriceFormat {
  let formatter: Intl.NumberFormat;
  try {
    formatter = new Intl.NumberFormat(`${language}-${country}`, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    });
  } catch {
    formatter = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });
  }
  const symbol =
    formatter.formatToParts(0).find((part) => part.type === 'currency')?.value ??
    currency;
  return { format: (value) => formatter.format(value), symbol };
}

/** Złoty, Polish style: every restaurant from before currencies were a choice. */
export const PriceFormatContext = createContext<PriceFormat>(priceFormat());
