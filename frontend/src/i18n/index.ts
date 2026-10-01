import i18n from 'i18next';
import type { BackendModule, ResourceKey } from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import { MENU_LANGUAGES } from '../constants/menuLanguages';
import en from './locales/en.json';
import pl from './locales/pl.json';

/**
 * Public-menu translations.
 *
 * This covers the *static* interface only — labels, aria text, empty states.
 * The menu's own content (category names, dish names, descriptions) comes
 * translated from the API, out of the owner's dictionary. The two halves meet
 * in `usePublicMenu`, which sends the language resolved here to the API.
 *
 * There is a locale for every language in the catalogue
 * (constants/menuLanguages.ts). Which of them a guest is offered is the
 * restaurant's choice, carried on the menu itself — see LanguageSwitcher.
 */

/** Every language the guest interface can speak: the whole catalogue. */
export const SUPPORTED_LANGUAGES: readonly string[] = MENU_LANGUAGES.map(
  (language) => language.code,
);

/** Endonyms: a switcher that renames itself is useless to whoever cannot read
 *  the language currently active. */
export const LANGUAGE_LABELS: Record<string, string> = Object.fromEntries(
  MENU_LANGUAGES.map((language) => [language.code, language.endonym]),
);

// Polish and English ship with the page: the menus are written in one and
// nearly every restaurant offers the other. The rest are fetched the first
// time a guest needs them, so a menu does not carry thirty languages to show
// one.
const loaders = import.meta.glob<{ default: ResourceKey }>([
  './locales/*.json',
  '!./locales/pl.json',
  '!./locales/en.json',
]);

const lazyLocales: BackendModule = {
  type: 'backend',
  init() {},
  read(language, _namespace, callback) {
    const load = loaders[`./locales/${language}.json`];
    if (!load) {
      callback(null, {});
      return;
    }
    load().then(
      (module) => callback(null, module.default),
      (error: Error) => callback(error, null),
    );
  },
};

void i18n
  .use(lazyLocales)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      pl: { translation: pl },
      en: { translation: en },
    },
    // The bundled two above, plus the backend for everything else.
    partialBundledLanguages: true,
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
