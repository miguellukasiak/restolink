import { useCallback } from 'react';
import i18next from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  MENU_LANGUAGES,
  getMenuLanguage,
  languageName,
  languageTag,
} from '../constants/menuLanguages';
import en from './panel/en.json';
import pl from './panel/pl.json';

/*
 * The owner panel's own translations — separate from the guest menu's.
 *
 * Every panel is English. HQ can give a restaurant one more language
 * (`restaurant.panel_language`), and the panel then shows a switch between the
 * two. English and Polish are written by hand and bundled
 * (src/i18n/panel/<code>.json). Any other catalogue language is translated by
 * DeepL from the English the first time HQ chooses it
 * (backend/app/routers/panel_locales.py) and loaded from the API here; until
 * it exists — or for any string it lacks — the panel reads English.
 *
 * A second i18next instance rather than a namespace of the guest one: the two
 * languages are independent. An owner reading the panel in English may be
 * previewing a menu a guest will read in German, and the guest instance's
 * detection (query string, browser) must never decide the panel's language.
 * Deliberately not registered with react-i18next: `usePanelT` passes it by
 * hand, so every `useTranslation()` in the guest components keeps meaning the
 * guest instance.
 */

/** Written by hand and bundled: English, the source, and Polish. */
export const BUILT_IN_PANEL_LANGUAGES = ['en', 'pl'] as const;

/** The panel lays out left to right; these need a mirrored layout first. */
const RIGHT_TO_LEFT = new Set(
  MENU_LANGUAGES.filter((language) => language.rtl).map((language) => language.code),
);

/**
 * Every language a panel can speak: the bundled ones, then every catalogue
 * language, which DeepL translates on first use. Mirrors PANEL_LANGUAGES in
 * backend/app/panel_language.py.
 */
export const PANEL_LANGUAGES: readonly string[] = [
  ...BUILT_IN_PANEL_LANGUAGES,
  ...MENU_LANGUAGES.map((language) => language.code).filter(
    (code) =>
      !(BUILT_IN_PANEL_LANGUAGES as readonly string[]).includes(code) &&
      !RIGHT_TO_LEFT.has(code),
  ),
];

/** A panel language code. */
export type PanelLanguage = string;

export const PANEL_DEFAULT_LANGUAGE: PanelLanguage = 'en';

/** A panel language in its own words, for the switch: "Polski", "Українська". */
export function panelLanguageLabel(code: string): string {
  if (code === 'en') return 'English';
  if (code === 'pl') return 'Polski';
  return getMenuLanguage(code)?.endonym ?? languageTag(code);
}

const STORAGE_KEY = 'restolink.panel.lang';

export function isPanelLanguage(code: unknown): code is PanelLanguage {
  return typeof code === 'string' && PANEL_LANGUAGES.includes(code);
}

const isBuiltIn = (code: string) =>
  (BUILT_IN_PANEL_LANGUAGES as readonly string[]).includes(code);

function storedLanguage(): PanelLanguage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isPanelLanguage(stored) ? stored : PANEL_DEFAULT_LANGUAGE;
  } catch {
    return PANEL_DEFAULT_LANGUAGE;
  }
}

export const panelI18n = i18next.createInstance();

void panelI18n.init({
  resources: { en: { panel: en }, pl: { panel: pl } },
  ns: ['panel'],
  defaultNS: 'panel',
  lng: storedLanguage(),
  // Whatever a DeepL language lacks — or all of it, until it has loaded —
  // reads in English.
  fallbackLng: PANEL_DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
  // The bundled languages need nothing loaded; the rest are added by hand.
  initAsync: false,
  react: { useSuspense: false, bindI18nStore: 'added' },
});

/** "a.b_one" keys back into the nested tree i18next reads. */
function unflatten(strings: Record<string, string>) {
  const tree: Record<string, unknown> = {};
  for (const [key, text] of Object.entries(strings)) {
    const parts = key.split('.');
    let node = tree;
    for (const part of parts.slice(0, -1)) {
      if (typeof node[part] !== 'object' || node[part] === null) node[part] = {};
      node = node[part] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]] = text;
  }
  return tree;
}

const loading = new Map<string, Promise<boolean>>();

/**
 * Makes a panel language readable: bundled ones at once, a DeepL one by
 * fetching it. Resolves false when it does not exist yet — HQ chose it but
 * its translation has not been made — and the panel stays in English.
 */
export function loadPanelLanguage(code: string): Promise<boolean> {
  if (isBuiltIn(code) || panelI18n.hasResourceBundle(code, 'panel')) {
    return Promise.resolve(true);
  }
  if (!isPanelLanguage(code)) return Promise.resolve(false);
  const pending = loading.get(code);
  if (pending) return pending;
  // Imported when needed: the API module reads the panel language itself.
  const request = import('../services/panelLocaleService')
    .then(({ fetchPanelLocale }) => fetchPanelLocale(code))
    .then((locale) => {
      if (!locale) return false;
      panelI18n.addResourceBundle(code, 'panel', unflatten(locale.strings), true, true);
      return true;
    })
    .catch(() => false)
    .finally(() => loading.delete(code));
  loading.set(code, request);
  return request;
}

// A DeepL language remembered on this device: fetch it, then re-render in it.
if (!isBuiltIn(panelI18n.language)) {
  const remembered = panelI18n.language;
  void loadPanelLanguage(remembered).then((ok) => {
    if (ok && panelI18n.language === remembered)
      void panelI18n.changeLanguage(remembered);
  });
}

/** The panel's `t`, and its instance for the current language. */
export function usePanelT() {
  return useTranslation('panel', { i18n: panelI18n });
}

/** Names a menu language in the panel's language: "German", "niemiecki". */
export function useLanguageName() {
  const { i18n } = usePanelT();
  const locale = i18n.language;
  return useCallback((code: string) => languageName(code, locale), [locale]);
}

/** The panel's current language — the one chosen, loaded or still loading. */
export function panelLanguage(): PanelLanguage {
  const code = panelI18n.language;
  return isPanelLanguage(code) ? code : PANEL_DEFAULT_LANGUAGE;
}

/**
 * Switch the panel, and remember the choice on this device. A DeepL language
 * is fetched first; one not made yet leaves the panel in English for now,
 * while the choice is still remembered for when it is.
 */
export function setPanelLanguage(code: PanelLanguage) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Private mode: the switch still works for this visit.
  }
  void loadPanelLanguage(code).then(() => panelI18n.changeLanguage(code));
}

/** A panel string outside React (services, helpers called from handlers). */
export const tp = (key: string, options?: Record<string, unknown>) =>
  panelI18n.t(key, options) as string;
