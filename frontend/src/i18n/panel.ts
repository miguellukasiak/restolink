import { useCallback } from 'react';
import i18next from 'i18next';
import { useTranslation } from 'react-i18next';
import { languageName } from '../constants/menuLanguages';
import en from './panel/en.json';
import pl from './panel/pl.json';

/*
 * The owner panel's own translations — separate from the guest menu's.
 *
 * Every panel is English. HQ can give a restaurant one more language
 * (`restaurant.panel_language`), and the panel then shows a switch between the
 * two. A language here needs the whole panel in src/i18n/panel/<code>.json and
 * its emails and server messages in the backend (app/panel_language.py
 * explains); backend/tests/test_panel_language.py checks the files agree.
 *
 * A second i18next instance rather than a namespace of the guest one: the two
 * languages are independent. An owner reading the panel in English may be
 * previewing a menu a guest will read in German, and the guest instance's
 * detection (query string, browser) must never decide the panel's language.
 * Deliberately not registered with react-i18next: `usePanelT` passes it by
 * hand, so every `useTranslation()` in the guest components keeps meaning the
 * guest instance.
 */

/** Every language the panel has been translated into. */
export const PANEL_LANGUAGES = ['en', 'pl'] as const;
export type PanelLanguage = (typeof PANEL_LANGUAGES)[number];

export const PANEL_DEFAULT_LANGUAGE: PanelLanguage = 'en';

/** Names in their own language, for the switch. */
export const PANEL_LANGUAGE_LABELS: Record<PanelLanguage, string> = {
  en: 'English',
  pl: 'Polski',
};

const STORAGE_KEY = 'restolink.panel.lang';

export function isPanelLanguage(code: unknown): code is PanelLanguage {
  return (
    typeof code === 'string' && (PANEL_LANGUAGES as readonly string[]).includes(code)
  );
}

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
  fallbackLng: PANEL_DEFAULT_LANGUAGE,
  supportedLngs: [...PANEL_LANGUAGES],
  interpolation: { escapeValue: false },
  // Both languages are bundled, so nothing ever has to load.
  initAsync: false,
  react: { useSuspense: false },
});

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

/** The panel's current language. */
export function panelLanguage(): PanelLanguage {
  const code = panelI18n.resolvedLanguage ?? panelI18n.language;
  return isPanelLanguage(code) ? code : PANEL_DEFAULT_LANGUAGE;
}

/** Switch the panel, and remember the choice on this device. */
export function setPanelLanguage(code: PanelLanguage) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Private mode: the switch still works for this visit.
  }
  void panelI18n.changeLanguage(code);
}

/** A panel string outside React (services, helpers called from handlers). */
export const tp = (key: string, options?: Record<string, unknown>) =>
  panelI18n.t(key, options) as string;
