import { languageName } from '../../constants/menuLanguages';

/** A panel language as HQ reads it: "Polski", "Czeski" — the HQ panel is Polish. */
export function panelLanguageLabel(code: string): string {
  const name = languageName(code, 'pl');
  return name.charAt(0).toLocaleUpperCase('pl') + name.slice(1);
}
