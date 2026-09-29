import { useMemo, type ReactNode } from 'react';
import i18next from 'i18next';
import { I18nextProvider } from 'react-i18next';
import guestEn from '../../i18n/locales/en.json';
import guestPl from '../../i18n/locales/pl.json';
import { usePanelT } from '../../i18n/panel';

/**
 * Guest-menu components rendered inside the panel — the phone previews, the
 * dish preview — speak the panel's language.
 *
 * Left alone they would follow the guest menu's own detection (a remembered
 * choice, the browser), so an owner reading the panel in Polish could see a
 * preview labelled "Description". A small private instance, not a clone of
 * the guest one: a clone carries the guest detector, which would write the
 * panel's language into the guest menu's remembered choice on this device.
 */
export function GuestPreviewLanguage({ children }: { children: ReactNode }) {
  const { i18n } = usePanelT();
  const language = i18n.language;

  const instance = useMemo(() => {
    const preview = i18next.createInstance();
    void preview.init({
      resources: { en: { translation: guestEn }, pl: { translation: guestPl } },
      lng: language,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      initAsync: false,
      react: { useSuspense: false },
    });
    return preview;
  }, [language]);

  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
