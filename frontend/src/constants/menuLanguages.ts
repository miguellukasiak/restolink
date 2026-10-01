/*
 * The languages a menu can be written in and offered in: what the owner
 * picks from in "Języki" and what a guest can switch to. A restaurant's own
 * language (`base_language`) is left out of what it can add.
 *
 * The codes and their order mirror MENU_LANGUAGES in the backend
 * (app/menu_languages.py); every one also has a guest-interface locale in
 * src/i18n/locales. backend/tests/test_languages.py checks all three agree.
 *
 * The owner reads language names in the panel's language — `languageName`,
 * from the browser's own Intl data, so no list of names is kept here — and
 * the reasons as panel strings (`languages.reason.<code>`).
 */

export interface MenuLanguage {
  code: string;
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
  /**
   * Has a one-line why (`languages.reason.<code>`). Only claims that hold
   * without a statistic behind them.
   */
  reason?: boolean;
}

export const MENU_LANGUAGES: readonly MenuLanguage[] = [
  {
    code: 'en',
    endonym: 'English',
    tier: 1,
    reason: true,
  },
  {
    code: 'de',
    endonym: 'Deutsch',
    tier: 1,
    reason: true,
  },
  {
    code: 'uk',
    endonym: 'Українська',
    tier: 1,
    reason: true,
  },
  {
    code: 'fr',
    endonym: 'Français',
    tier: 2,
    reason: true,
  },
  {
    code: 'es',
    endonym: 'Español',
    tier: 2,
    reason: true,
  },
  {
    code: 'it',
    endonym: 'Italiano',
    tier: 2,
    reason: true,
  },
  { code: 'pt', endonym: 'Português' },
  { code: 'nl', endonym: 'Nederlands' },
  {
    code: 'cs',
    endonym: 'Čeština',
    tier: 2,
    reason: true,
  },
  {
    code: 'sk',
    endonym: 'Slovenčina',
    tier: 2,
    reason: true,
  },
  // For a restaurant abroad; a Polish menu has it as its own language.
  { code: 'pl', endonym: 'Polski' },
  {
    code: 'ru',
    endonym: 'Русский',
    reason: true,
  },
  {
    code: 'lt',
    endonym: 'Lietuvių',
    tier: 2,
    reason: true,
  },
  { code: 'lv', endonym: 'Latviešu' },
  { code: 'et', endonym: 'Eesti' },
  { code: 'hu', endonym: 'Magyar' },
  { code: 'ro', endonym: 'Română' },
  { code: 'bg', endonym: 'Български' },
  { code: 'el', endonym: 'Ελληνικά' },
  { code: 'sl', endonym: 'Slovenščina' },
  { code: 'hr', endonym: 'Hrvatski' },
  {
    code: 'sv',
    endonym: 'Svenska',
    tier: 2,
    reason: true,
  },
  { code: 'nb', endonym: 'Norsk' },
  { code: 'da', endonym: 'Dansk' },
  { code: 'fi', endonym: 'Suomi' },
  { code: 'tr', endonym: 'Türkçe' },
  {
    code: 'he',
    endonym: 'עברית',
    rtl: true,
    tier: 2,
    reason: true,
  },
  {
    code: 'ar',
    endonym: 'العربية',
    rtl: true,
    tier: 2,
    reason: true,
  },
  { code: 'zh', endonym: '中文' },
  { code: 'ja', endonym: '日本語' },
  { code: 'ko', endonym: '한국어' },
  { code: 'vi', endonym: 'Tiếng Việt' },
  { code: 'hi', endonym: 'हिन्दी' },
  { code: 'id', endonym: 'Bahasa Indonesia' },
  { code: 'th', endonym: 'ไทย' },
];

const BY_CODE = new Map(MENU_LANGUAGES.map((language) => [language.code, language]));

export function getMenuLanguage(code: string): MenuLanguage | undefined {
  return BY_CODE.get(code);
}

const displayNames = new Map<string, Intl.DisplayNames | null>();

/** A language's name in `locale` ("German", "niemiecki"); the code if the
 *  browser has no name for it. */
export function languageName(code: string, locale: string): string {
  if (!displayNames.has(locale)) {
    try {
      displayNames.set(locale, new Intl.DisplayNames([locale], { type: 'language' }));
    } catch {
      displayNames.set(locale, null);
    }
  }
  return displayNames.get(locale)?.of(code) ?? code;
}

/** Beyond this many offered languages the screen starts to advise restraint. */
export const MANY_LANGUAGES = 6;

/** Adding a language past this one asks the owner to confirm. */
export const CONFIRM_LANGUAGES_OVER = 10;
