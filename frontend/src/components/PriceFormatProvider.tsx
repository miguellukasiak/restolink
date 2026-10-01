import { useMemo, type ReactNode } from 'react';
import { PriceFormatContext, priceFormat } from '../utils/price';

/** Prices below are written in `currency`, the way `country` and the menu's
 *  `language` write money. Absent values keep złoty, Polish style. */
export function PriceFormatProvider({
  currency,
  country,
  language,
  children,
}: {
  currency?: string;
  country?: string;
  language?: string;
  children: ReactNode;
}) {
  const value = useMemo(
    () => priceFormat(currency, country, language),
    [currency, country, language],
  );
  return (
    <PriceFormatContext.Provider value={value}>{children}</PriceFormatContext.Provider>
  );
}
