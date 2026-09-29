/*
 * How many people can read a menu, and where — the numbers behind the map on
 * the "Języki" screen.
 *
 * For every country: the share of its people who can comfortably read a menu
 * in a language, natively or as a well-known second language. These are
 * rounded estimates, not a census: native languages come from each country's
 * own make-up, and second-language shares (English above all) are deliberately
 * conservative. Populations come from Natural Earth with the map itself.
 *
 * A country's coverage combines its languages as independent chances,
 * 1 − Π(1 − share), so it never exceeds 1 and a person is counted once however
 * many of the menu's languages they read. That is what makes the headline
 * honest: adding Swedish after English adds the Swedes who do *not* read
 * English, not all of Sweden again.
 *
 * Keys are ISO 3166-1 alpha-2 codes, except SOL (Somaliland) and CYN
 * (Northern Cyprus), which have none — the same keys worldCountries.json uses.
 */

export const COUNTRY_SHARES: Record<string, Record<string, number>> = {
  RU: { ru: 0.99, en: 0.08 },
  DE: { de: 0.97, en: 0.6 },
  FR: { fr: 0.98, en: 0.4 },
  GB: { en: 0.98 },
  IT: { it: 0.97, en: 0.35 },
  ES: { es: 0.98, en: 0.35 },
  UA: { uk: 0.9, ru: 0.75, en: 0.2 },
  PL: { pl: 0.99, en: 0.4, de: 0.1 },
  RO: { ro: 0.97, en: 0.35, hu: 0.06 },
  NL: { nl: 0.97, en: 0.9, de: 0.5 },
  BE: { nl: 0.6, fr: 0.6, en: 0.6, de: 0.1 },
  GR: { el: 0.99, en: 0.5 },
  CZ: { cs: 0.98, sk: 0.8, en: 0.35, de: 0.1 },
  SE: { sv: 0.97, en: 0.9, nb: 0.7, da: 0.5 },
  PT: { pt: 0.99, en: 0.5, es: 0.3 },
  HU: { hu: 0.99, en: 0.3, de: 0.15 },
  BY: { ru: 0.95, en: 0.1, pl: 0.03 },
  AT: { de: 0.97, en: 0.7 },
  CH: { de: 0.65, fr: 0.3, it: 0.12, en: 0.65 },
  BG: { bg: 0.97, ru: 0.3, en: 0.3 },
  RS: { hr: 0.8, en: 0.4, ru: 0.1 },
  DK: { da: 0.97, en: 0.88, nb: 0.8, sv: 0.6, de: 0.3 },
  FI: { fi: 0.9, sv: 0.3, en: 0.75 },
  SK: { sk: 0.98, cs: 0.9, en: 0.35, hu: 0.08 },
  NO: { nb: 0.97, en: 0.9, sv: 0.8, da: 0.8 },
  IE: { en: 0.99 },
  HR: { hr: 0.98, en: 0.55, de: 0.2 },
  BA: { hr: 0.9, en: 0.35 },
  AL: { en: 0.35, it: 0.3 },
  LT: { lt: 0.86, ru: 0.6, en: 0.45, pl: 0.07 },
  MD: { ro: 0.8, ru: 0.7, en: 0.2 },
  SI: { sl: 0.97, hr: 0.5, en: 0.6, de: 0.3 },
  MK: { bg: 0.6, hr: 0.4, en: 0.35 },
  LV: { lv: 0.7, ru: 0.65, en: 0.5 },
  XK: { en: 0.4, hr: 0.1 },
  EE: { et: 0.7, ru: 0.45, en: 0.6, fi: 0.2 },
  LU: { fr: 0.9, de: 0.9, en: 0.8, pt: 0.15 },
  ME: { hr: 0.85, en: 0.35, ru: 0.1 },
  IS: { en: 0.9, da: 0.3 },
  CY: { el: 0.8, en: 0.75, tr: 0.1 },
  CYN: { tr: 0.95, en: 0.4 },
  CN: { zh: 0.95, en: 0.05 },
  IN: { hi: 0.5, en: 0.12 },
  ID: { id: 0.93, en: 0.1 },
  PK: { en: 0.1 },
  BD: { en: 0.05 },
  JP: { ja: 0.99, en: 0.15 },
  PH: { en: 0.6 },
  VN: { vi: 0.97, en: 0.08 },
  TR: { tr: 0.95, en: 0.12 },
  IR: { en: 0.05 },
  TH: { th: 0.95, en: 0.1 },
  MM: { en: 0.05 },
  KR: { ko: 0.99, en: 0.25 },
  IQ: { ar: 0.8, en: 0.05 },
  AF: { en: 0.03 },
  SA: { ar: 0.7, en: 0.35 },
  UZ: { ru: 0.4, en: 0.05 },
  MY: { en: 0.55, id: 0.75, zh: 0.23 },
  YE: { ar: 0.95 },
  NP: { hi: 0.4, en: 0.1 },
  KP: { ko: 0.99 },
  TW: { zh: 0.85, en: 0.15, ja: 0.05 },
  LK: { en: 0.2 },
  KZ: { ru: 0.85, en: 0.1 },
  SY: { ar: 0.9 },
  KH: { en: 0.05 },
  JO: { ar: 0.98, en: 0.3 },
  AZ: { tr: 0.6, ru: 0.3, en: 0.1 },
  AE: { ar: 0.35, en: 0.8, hi: 0.2 },
  TJ: { ru: 0.3 },
  IL: { he: 0.9, en: 0.8, ar: 0.2, ru: 0.15 },
  LA: { th: 0.3, en: 0.03 },
  LB: { ar: 0.95, fr: 0.4, en: 0.4 },
  KG: { ru: 0.5 },
  TM: { ru: 0.2 },
  OM: { ar: 0.6, en: 0.4, hi: 0.1 },
  PS: { ar: 0.98, en: 0.15, he: 0.1 },
  KW: { ar: 0.45, en: 0.5, hi: 0.15 },
  GE: { ru: 0.4, en: 0.2 },
  MN: { ru: 0.1, en: 0.1 },
  AM: { ru: 0.6, en: 0.2 },
  QA: { ar: 0.3, en: 0.8, hi: 0.2 },
  TL: { id: 0.3, pt: 0.25, en: 0.1 },
  BT: { en: 0.3, hi: 0.2 },
  BN: { id: 0.6, en: 0.5, zh: 0.1 },
  NG: { en: 0.5 },
  ET: { en: 0.05 },
  EG: { ar: 0.95, en: 0.1 },
  CD: { fr: 0.4 },
  ZA: { en: 0.6 },
  TZ: { en: 0.1 },
  KE: { en: 0.45 },
  UG: { en: 0.35 },
  DZ: { ar: 0.8, fr: 0.35 },
  SD: { ar: 0.8, en: 0.05 },
  MA: { ar: 0.7, fr: 0.35, es: 0.05 },
  AO: { pt: 0.75 },
  GH: { en: 0.6 },
  MZ: { pt: 0.5 },
  MG: { fr: 0.2 },
  CM: { fr: 0.6, en: 0.3 },
  CI: { fr: 0.7 },
  NE: { fr: 0.15 },
  BF: { fr: 0.25 },
  ML: { fr: 0.2 },
  MW: { en: 0.3 },
  ZM: { en: 0.5 },
  SN: { fr: 0.3 },
  TD: { fr: 0.2, ar: 0.3 },
  ZW: { en: 0.6 },
  GN: { fr: 0.25 },
  RW: { en: 0.2, fr: 0.1 },
  BJ: { fr: 0.35 },
  TN: { ar: 0.95, fr: 0.5, en: 0.1 },
  BI: { fr: 0.1 },
  SS: { en: 0.2, ar: 0.2 },
  SO: { ar: 0.2, en: 0.05 },
  TG: { fr: 0.4 },
  SL: { en: 0.3 },
  LY: { ar: 0.95, en: 0.05 },
  ER: { ar: 0.1, en: 0.1 },
  CG: { fr: 0.6 },
  SOL: { ar: 0.1, en: 0.05 },
  LR: { en: 0.4 },
  CF: { fr: 0.3 },
  MR: { ar: 0.8, fr: 0.15 },
  NA: { en: 0.5 },
  BW: { en: 0.6 },
  GM: { en: 0.3 },
  GA: { fr: 0.8 },
  LS: { en: 0.4 },
  GW: { pt: 0.2 },
  GQ: { es: 0.7, fr: 0.1 },
  SZ: { en: 0.5 },
  DJ: { fr: 0.5, ar: 0.2 },
  EH: { ar: 0.8, es: 0.2 },
  US: { en: 0.95, es: 0.13 },
  MX: { es: 0.99, en: 0.1 },
  CA: { en: 0.86, fr: 0.3 },
  GT: { es: 0.9 },
  HT: { fr: 0.4 },
  CU: { es: 0.99 },
  DO: { es: 0.99, en: 0.1 },
  HN: { es: 0.99 },
  NI: { es: 0.99 },
  SV: { es: 0.99 },
  CR: { es: 0.99, en: 0.2 },
  PA: { es: 0.95, en: 0.15 },
  PR: { es: 0.95, en: 0.5 },
  JM: { en: 0.9 },
  TT: { en: 0.95 },
  BS: { en: 0.98 },
  BZ: { en: 0.8, es: 0.5 },
  GL: { da: 0.5, en: 0.2 },
  AU: { en: 0.97 },
  PG: { en: 0.3 },
  NZ: { en: 0.98 },
  FJ: { en: 0.8, hi: 0.3 },
  SB: { en: 0.3 },
  VU: { en: 0.3, fr: 0.3 },
  NC: { fr: 0.95 },
  BR: { pt: 0.99, es: 0.1, en: 0.05 },
  CO: { es: 0.99, en: 0.05 },
  AR: { es: 0.99, en: 0.15, it: 0.05 },
  PE: { es: 0.85, en: 0.05 },
  VE: { es: 0.99, en: 0.05 },
  CL: { es: 0.99, en: 0.1 },
  EC: { es: 0.95, en: 0.05 },
  BO: { es: 0.85 },
  PY: { es: 0.8 },
  UY: { es: 0.99, en: 0.15, pt: 0.1 },
  GY: { en: 0.9 },
  SR: { nl: 0.8, en: 0.4 },
  FK: { en: 1 },
};

/** A country as the model needs it. */
export interface PopulatedCountry {
  key: string;
  pop: number;
}

/** Share of a country's people who can read at least one of `languages`. */
export function coverage(countryKey: string, languages: Iterable<string>): number {
  const shares = COUNTRY_SHARES[countryKey];
  if (!shares) return 0;
  let missed = 1;
  for (const language of languages) missed *= 1 - (shares[language] ?? 0);
  return 1 - missed;
}

/** People, worldwide, who can read at least one of `languages`. */
export function reach(
  countries: readonly PopulatedCountry[],
  languages: readonly string[],
) {
  let total = 0;
  for (const country of countries)
    total += country.pop * coverage(country.key, languages);
  return total;
}

/** People that adding `language` to `languages` would newly reach. */
export function gain(
  countries: readonly PopulatedCountry[],
  languages: readonly string[],
  language: string,
) {
  if (languages.includes(language)) return 0;
  return reach(countries, [...languages, language]) - reach(countries, languages);
}

/**
 * The language that would help a country most, among `candidates` not yet in
 * `languages` — what clicking the country on the map adds. Null when none of
 * them is read there at all.
 */
export function bestLanguageFor(
  countryKey: string,
  languages: readonly string[],
  candidates: readonly string[],
): { code: string; share: number } | null {
  const shares = COUNTRY_SHARES[countryKey] ?? {};
  let best: { code: string; share: number } | null = null;
  for (const code of candidates) {
    const share = shares[code] ?? 0;
    if (share > 0 && !languages.includes(code) && (!best || share > best.share)) {
      best = { code, share };
    }
  }
  return best;
}

/**
 * Coverage in four plain steps for the map. Continuous shading made Russia,
 * at 8% English, look "a bit covered" and tinted half the world; below one in
 * ten counts as not covered.
 */
export function coverageStep(value: number): 0 | 1 | 2 | 3 {
  if (value >= 0.85) return 3;
  if (value >= 0.5) return 2;
  if (value >= 0.1) return 1;
  return 0;
}

/** "1,6 mld", "41 mln", "850 tys." (or "1.6B", "41M", "850K") — rounded as
 *  a person would say it: one decimal only below ten of a unit. */
export function formatPeople(value: number, locale = 'pl'): string {
  const unit = value >= 1e9 ? 1e9 : value >= 1e6 ? 1e6 : 1e3;
  const digits = unit === 1e9 || (unit === 1e6 && value / unit < 10) ? 1 : 0;
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: digits,
  }).format(value);
}

const regionNames = new Map<string, Intl.DisplayNames | null>();

/**
 * A country's name in `locale`, from the browser's own data. The map's file
 * carries a Polish name for the few keys the browser may not know.
 */
export function countryName(key: string, fallback: string, locale: string): string {
  if (!regionNames.has(locale)) {
    try {
      regionNames.set(locale, new Intl.DisplayNames([locale], { type: 'region' }));
    } catch {
      regionNames.set(locale, null);
    }
  }
  try {
    const name = regionNames.get(locale)?.of(key);
    if (name && name !== key) return name;
  } catch {
    // Not a region code the browser accepts.
  }
  return fallback;
}
