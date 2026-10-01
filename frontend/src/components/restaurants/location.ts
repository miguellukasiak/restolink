import { COUNTRIES } from '../../constants/countries';

/** Where a restaurant is, and what its menu is written and priced in. */
export interface RestaurantLocation {
  country: string;
  address: string;
  currency: string;
  base_language: string;
}

/** What a new restaurant in `country` starts with. */
export function locationFor(country: string, address = ''): RestaurantLocation {
  const [currency, base_language] = COUNTRIES[country] ?? COUNTRIES.PL;
  return { country, address, currency, base_language };
}
