import { useContext } from 'react';
import { PriceFormatContext, type PriceFormat } from '../utils/price';

/** How the menu around this component writes prices. */
export function usePriceFormat(): PriceFormat {
  return useContext(PriceFormatContext);
}
