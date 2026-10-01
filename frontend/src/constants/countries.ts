/*
 * Where a restaurant is, and what follows from it — mirrors
 * backend/app/countries.py (backend/tests/test_countries.py keeps the two
 * equal).
 *
 * HQ sets the country; it decides where the Languages map pins the restaurant
 * and which languages it recommends, and gives the starting currency and menu
 * language, which HQ can change. Names come from Intl.DisplayNames, in the
 * reader's language, never from a list kept here.
 */

/** ISO 3166-1 alpha-2 → [ISO 4217 currency, the menu language it starts with]. */
export const COUNTRIES: Record<string, readonly [currency: string, menuLanguage: string]> = {
  // Europe
  AD: ['EUR', 'es'],
  AL: ['ALL', 'en'],
  AT: ['EUR', 'de'],
  BA: ['BAM', 'en'],
  BE: ['EUR', 'nl'],
  BG: ['EUR', 'bg'],
  BY: ['BYN', 'ru'],
  CH: ['CHF', 'de'],
  CY: ['EUR', 'el'],
  CZ: ['CZK', 'cs'],
  DE: ['EUR', 'de'],
  DK: ['DKK', 'da'],
  EE: ['EUR', 'et'],
  ES: ['EUR', 'es'],
  FI: ['EUR', 'fi'],
  FO: ['DKK', 'da'],
  FR: ['EUR', 'fr'],
  GB: ['GBP', 'en'],
  GI: ['GIP', 'en'],
  GR: ['EUR', 'el'],
  HR: ['EUR', 'hr'],
  HU: ['HUF', 'hu'],
  IE: ['EUR', 'en'],
  IS: ['ISK', 'en'],
  IT: ['EUR', 'it'],
  LI: ['CHF', 'de'],
  LT: ['EUR', 'lt'],
  LU: ['EUR', 'fr'],
  LV: ['EUR', 'lv'],
  MC: ['EUR', 'fr'],
  MD: ['MDL', 'ro'],
  ME: ['EUR', 'en'],
  MK: ['MKD', 'en'],
  MT: ['EUR', 'en'],
  NL: ['EUR', 'nl'],
  NO: ['NOK', 'nb'],
  PL: ['PLN', 'pl'],
  PT: ['EUR', 'pt'],
  RO: ['RON', 'ro'],
  RS: ['RSD', 'en'],
  RU: ['RUB', 'ru'],
  SE: ['SEK', 'sv'],
  SI: ['EUR', 'sl'],
  SK: ['EUR', 'sk'],
  SM: ['EUR', 'it'],
  UA: ['UAH', 'uk'],
  VA: ['EUR', 'it'],
  XK: ['EUR', 'en'],
  // Caucasus, Middle East and Central Asia
  AE: ['AED', 'ar'],
  AM: ['AMD', 'en'],
  AZ: ['AZN', 'en'],
  BH: ['BHD', 'ar'],
  GE: ['GEL', 'en'],
  IL: ['ILS', 'he'],
  IQ: ['IQD', 'ar'],
  IR: ['IRR', 'en'],
  JO: ['JOD', 'ar'],
  KG: ['KGS', 'ru'],
  KW: ['KWD', 'ar'],
  KZ: ['KZT', 'ru'],
  LB: ['LBP', 'ar'],
  OM: ['OMR', 'ar'],
  PS: ['ILS', 'ar'],
  QA: ['QAR', 'ar'],
  SA: ['SAR', 'ar'],
  SY: ['SYP', 'ar'],
  TJ: ['TJS', 'ru'],
  TM: ['TMT', 'ru'],
  TR: ['TRY', 'tr'],
  UZ: ['UZS', 'ru'],
  YE: ['YER', 'ar'],
  // Rest of Asia
  AF: ['AFN', 'en'],
  BD: ['BDT', 'en'],
  BN: ['BND', 'en'],
  BT: ['BTN', 'en'],
  CN: ['CNY', 'zh'],
  HK: ['HKD', 'zh'],
  ID: ['IDR', 'id'],
  IN: ['INR', 'hi'],
  JP: ['JPY', 'ja'],
  KH: ['KHR', 'en'],
  KR: ['KRW', 'ko'],
  LA: ['LAK', 'en'],
  LK: ['LKR', 'en'],
  MM: ['MMK', 'en'],
  MN: ['MNT', 'en'],
  MO: ['MOP', 'zh'],
  MV: ['MVR', 'en'],
  MY: ['MYR', 'en'],
  NP: ['NPR', 'en'],
  PH: ['PHP', 'en'],
  PK: ['PKR', 'en'],
  SG: ['SGD', 'en'],
  TH: ['THB', 'th'],
  TL: ['USD', 'pt'],
  TW: ['TWD', 'zh'],
  VN: ['VND', 'vi'],
  // Africa
  AO: ['AOA', 'pt'],
  BF: ['XOF', 'fr'],
  BI: ['BIF', 'fr'],
  BJ: ['XOF', 'fr'],
  BW: ['BWP', 'en'],
  CD: ['CDF', 'fr'],
  CF: ['XAF', 'fr'],
  CG: ['XAF', 'fr'],
  CI: ['XOF', 'fr'],
  CM: ['XAF', 'fr'],
  CV: ['CVE', 'pt'],
  DJ: ['DJF', 'fr'],
  DZ: ['DZD', 'ar'],
  EG: ['EGP', 'ar'],
  ER: ['ERN', 'en'],
  ET: ['ETB', 'en'],
  GA: ['XAF', 'fr'],
  GH: ['GHS', 'en'],
  GM: ['GMD', 'en'],
  GN: ['GNF', 'fr'],
  GQ: ['XAF', 'es'],
  GW: ['XOF', 'pt'],
  KE: ['KES', 'en'],
  KM: ['KMF', 'fr'],
  LR: ['LRD', 'en'],
  LS: ['LSL', 'en'],
  LY: ['LYD', 'ar'],
  MA: ['MAD', 'ar'],
  MG: ['MGA', 'fr'],
  ML: ['XOF', 'fr'],
  MR: ['MRU', 'ar'],
  MU: ['MUR', 'en'],
  MW: ['MWK', 'en'],
  MZ: ['MZN', 'pt'],
  NA: ['NAD', 'en'],
  NE: ['XOF', 'fr'],
  NG: ['NGN', 'en'],
  RW: ['RWF', 'en'],
  SC: ['SCR', 'en'],
  SD: ['SDG', 'ar'],
  SL: ['SLE', 'en'],
  SN: ['XOF', 'fr'],
  SO: ['SOS', 'en'],
  SS: ['SSP', 'en'],
  ST: ['STN', 'pt'],
  SZ: ['SZL', 'en'],
  TD: ['XAF', 'fr'],
  TG: ['XOF', 'fr'],
  TN: ['TND', 'ar'],
  TZ: ['TZS', 'en'],
  UG: ['UGX', 'en'],
  ZA: ['ZAR', 'en'],
  ZM: ['ZMW', 'en'],
  ZW: ['USD', 'en'],
  // Americas
  AG: ['XCD', 'en'],
  AR: ['ARS', 'es'],
  BB: ['BBD', 'en'],
  BO: ['BOB', 'es'],
  BR: ['BRL', 'pt'],
  BS: ['BSD', 'en'],
  BZ: ['BZD', 'en'],
  CA: ['CAD', 'en'],
  CL: ['CLP', 'es'],
  CO: ['COP', 'es'],
  CR: ['CRC', 'es'],
  CU: ['CUP', 'es'],
  DM: ['XCD', 'en'],
  DO: ['DOP', 'es'],
  EC: ['USD', 'es'],
  GD: ['XCD', 'en'],
  GL: ['DKK', 'da'],
  GT: ['GTQ', 'es'],
  GY: ['GYD', 'en'],
  HN: ['HNL', 'es'],
  HT: ['HTG', 'fr'],
  JM: ['JMD', 'en'],
  KN: ['XCD', 'en'],
  LC: ['XCD', 'en'],
  MX: ['MXN', 'es'],
  NI: ['NIO', 'es'],
  PA: ['USD', 'es'],
  PE: ['PEN', 'es'],
  PR: ['USD', 'es'],
  PY: ['PYG', 'es'],
  SR: ['SRD', 'nl'],
  SV: ['USD', 'es'],
  TT: ['TTD', 'en'],
  US: ['USD', 'en'],
  UY: ['UYU', 'es'],
  VC: ['XCD', 'en'],
  VE: ['VES', 'es'],
  // Oceania
  AU: ['AUD', 'en'],
  FJ: ['FJD', 'en'],
  FM: ['USD', 'en'],
  KI: ['AUD', 'en'],
  MH: ['USD', 'en'],
  NC: ['XPF', 'fr'],
  NR: ['AUD', 'en'],
  NZ: ['NZD', 'en'],
  PF: ['XPF', 'fr'],
  PG: ['PGK', 'en'],
  PW: ['USD', 'en'],
  SB: ['SBD', 'en'],
  TO: ['TOP', 'en'],
  TV: ['AUD', 'en'],
  VU: ['VUV', 'en'],
  WS: ['WST', 'en'],
};

/** Every currency a menu can price in: the countries' own. */
export const CURRENCIES: readonly string[] = [
  ...new Set(Object.values(COUNTRIES).map(([currency]) => currency)),
].sort();

export const DEFAULT_COUNTRY = 'PL';
export const MAX_ADDRESS_LENGTH = 300;

export const isCountry = (code: unknown): code is string =>
  typeof code === 'string' && code in COUNTRIES;

/** A country's name in `locale`: "Turcja", "Turkey". */
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** A currency's name in `locale`: "lira turecka". */
export function currencyName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'currency' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** The flag of a country, from its code's regional-indicator letters. */
export function countryFlag(code: string): string {
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}
