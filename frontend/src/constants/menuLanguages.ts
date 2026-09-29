/*
 * The languages a menu can be offered in: what the owner picks from in
 * "Języki" and what a guest can switch to.
 *
 * The codes and their order mirror MENU_LANGUAGES in the backend
 * (app/menu_languages.py); every one also has a guest-interface locale in
 * src/i18n/locales. backend/tests/test_languages.py checks all three agree.
 */

export interface MenuLanguage {
  code: string;
  /** Polish name, for the owner. */
  name: string;
  /** The language's own name, for the guest — a switcher in a language you
   *  cannot read is no use to you. */
  endonym: string;
  /** Written right to left. */
  rtl?: boolean;
  /**
   * How much it matters to a restaurant in Poland: 1 — worth having in almost
   * any tourist-facing place; 2 — frequent guests in some regions. Left out
   * where there is no clear reason, which is the honest default.
   */
  tier?: 1 | 2;
  /** Why, in one line. Only claims that hold without a statistic behind them. */
  reason?: string;
}

export const MENU_LANGUAGES: readonly MenuLanguage[] = [
  {
    code: 'en',
    name: 'angielski',
    endonym: 'English',
    tier: 1,
    reason: 'Czyta go większość zagranicznych gości — od niego warto zacząć.',
  },
  {
    code: 'de',
    name: 'niemiecki',
    endonym: 'Deutsch',
    tier: 1,
    reason: 'Niemcy to najliczniejsza grupa zagranicznych turystów w Polsce.',
  },
  {
    code: 'uk',
    name: 'ukraiński',
    endonym: 'Українська',
    tier: 1,
    reason: 'W Polsce mieszka i pracuje bardzo wielu Ukraińców.',
  },
  {
    code: 'fr',
    name: 'francuski',
    endonym: 'Français',
    tier: 2,
    reason: 'Francuzi chętnie zwiedzają Kraków i Warszawę.',
  },
  {
    code: 'es',
    name: 'hiszpański',
    endonym: 'Español',
    tier: 2,
    reason:
      'Hiszpanie chętnie zwiedzają polskie miasta, a po hiszpańsku czyta pół Ameryki.',
  },
  {
    code: 'it',
    name: 'włoski',
    endonym: 'Italiano',
    tier: 2,
    reason: 'Włosi licznie odwiedzają Kraków, Warszawę i Gdańsk.',
  },
  { code: 'pt', name: 'portugalski', endonym: 'Português' },
  { code: 'nl', name: 'niderlandzki', endonym: 'Nederlands' },
  {
    code: 'cs',
    name: 'czeski',
    endonym: 'Čeština',
    tier: 2,
    reason: 'Czesi to częsci goście, zwłaszcza na południu Polski.',
  },
  {
    code: 'sk',
    name: 'słowacki',
    endonym: 'Slovenčina',
    tier: 2,
    reason: 'Słowacy chętnie przyjeżdżają w Tatry i do Małopolski.',
  },
  {
    code: 'ru',
    name: 'rosyjski',
    endonym: 'Русский',
    reason: 'Rozumie go wielu gości z Ukrainy, Białorusi i krajów bałtyckich.',
  },
  {
    code: 'lt',
    name: 'litewski',
    endonym: 'Lietuvių',
    tier: 2,
    reason: 'Litwini to częsci goście na Podlasiu i w Warszawie.',
  },
  { code: 'lv', name: 'łotewski', endonym: 'Latviešu' },
  { code: 'et', name: 'estoński', endonym: 'Eesti' },
  { code: 'hu', name: 'węgierski', endonym: 'Magyar' },
  { code: 'ro', name: 'rumuński', endonym: 'Română' },
  { code: 'bg', name: 'bułgarski', endonym: 'Български' },
  { code: 'el', name: 'grecki', endonym: 'Ελληνικά' },
  { code: 'sl', name: 'słoweński', endonym: 'Slovenščina' },
  { code: 'hr', name: 'chorwacki', endonym: 'Hrvatski' },
  {
    code: 'sv',
    name: 'szwedzki',
    endonym: 'Svenska',
    tier: 2,
    reason: 'Szwedzi często przypływają promami na Pomorze.',
  },
  { code: 'nb', name: 'norweski', endonym: 'Norsk' },
  { code: 'da', name: 'duński', endonym: 'Dansk' },
  { code: 'fi', name: 'fiński', endonym: 'Suomi' },
  { code: 'tr', name: 'turecki', endonym: 'Türkçe' },
  {
    code: 'he',
    name: 'hebrajski',
    endonym: 'עברית',
    rtl: true,
    tier: 2,
    reason: 'Izraelczycy licznie odwiedzają Kraków i Warszawę.',
  },
  {
    code: 'ar',
    name: 'arabski',
    endonym: 'العربية',
    rtl: true,
    tier: 2,
    reason: 'Turyści z krajów Zatoki Perskiej chętnie odwiedzają Zakopane.',
  },
  { code: 'zh', name: 'chiński', endonym: '中文' },
  { code: 'ja', name: 'japoński', endonym: '日本語' },
  { code: 'ko', name: 'koreański', endonym: '한국어' },
  { code: 'vi', name: 'wietnamski', endonym: 'Tiếng Việt' },
  { code: 'hi', name: 'hindi', endonym: 'हिन्दी' },
  { code: 'id', name: 'indonezyjski', endonym: 'Bahasa Indonesia' },
  { code: 'th', name: 'tajski', endonym: 'ไทย' },
];

/** The menu's own language, which is never in the catalogue above. */
export const BASE_LANGUAGE: MenuLanguage = {
  code: 'pl',
  name: 'polski',
  endonym: 'Polski',
};

const BY_CODE = new Map(
  [BASE_LANGUAGE, ...MENU_LANGUAGES].map((language) => [language.code, language]),
);

export function getMenuLanguage(code: string): MenuLanguage | undefined {
  return BY_CODE.get(code);
}

/** Beyond this many offered languages the screen starts to advise restraint. */
export const MANY_LANGUAGES = 6;

/** Adding a language past this one asks the owner to confirm. */
export const CONFIRM_LANGUAGES_OVER = 10;
