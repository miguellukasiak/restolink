import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import pl from './locales/pl.json';

/**
 * Public-menu translations.
 *
 * This covers the *static* interface only — labels, aria text, empty states.
 * The menu's own content (category names, dish names, descriptions) is
 * translated server-side and cached in Postgres, because it lives in the
 * restaurant's database and cannot be shipped in a dictionary. The two halves
 * meet in `usePublicMenu`, which sends the language resolved here to the API.
 */

/** Order here is the order shown in the menu's language switcher. */
export const SUPPORTED_LANGUAGES = ['pl', 'en', 'de', 'fr', 'es'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Endonyms: a switcher that renames itself is useless to whoever cannot read
 *  the language currently active. */
export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  pl: 'Polski',
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
};

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      pl: { translation: pl },
      en: { translation: en },
      de: { translation: de },
      fr: { translation: fr },
      es: { translation: es },
    },
    supportedLngs: SUPPORTED_LANGUAGES,
    // Polish, because that is the language the menus are written in: a guest
    // whose browser we cannot place still sees exactly what the restaurant
    // typed, untranslated but never wrong.
    fallbackLng: 'pl',
    // `de-AT` and `fr-CA` resolve to their base language instead of falling
    // through to the fallback.
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      // `?lang=de` first, so a QR code or a shared link can pin a language;
      // then the guest's own explicit choice; then the browser.
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'restolink.menu.lang',
      caches: ['localStorage'],
    },
  });

/** The two-letter code to send to the API — never a regional variant. */
export function currentMenuLanguage(): string {
  return (i18n.resolvedLanguage ?? i18n.language ?? 'pl').split('-')[0] ?? 'pl';
}

export default i18n;
