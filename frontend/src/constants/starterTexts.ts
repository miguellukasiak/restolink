/*
 * The words the panel offers to start a menu with — category names, the
 * one-click starter layout, notes between the sections, the texts printed on
 * QR templates — in the language the menu is written in
 * (`restaurant.base_language`), not the panel's: a Turkish restaurant gets
 * "Çorbalar", whoever reads its panel. One hand-written file per menu
 * language in src/i18n/starters/, loaded only for the one a restaurant uses;
 * starterTexts.test.ts keeps them complete and within what prints.
 */

export interface StarterTexts {
  /** One-tap names for a new category, in the order offered. */
  categories: string[];
  /** Note bodies, in the note markup, by `NOTE_TEMPLATES` key. */
  notes: Record<string, string>;
  qr: {
    cta: string;
    /** For a two-language headline, joined to English with " · ". */
    ctaShort: string;
    footer: string;
    footerShort: string;
    steps: string[];
  };
}

/** The skeleton an empty menu starts from in one click: starters, main
 *  courses, desserts, drinks — by their place in `categories`. */
const STARTER_PICKS = [0, 3, 7, 8];

export function starterCategories(texts: StarterTexts): string[] {
  return STARTER_PICKS.map((index) => texts.categories[index]);
}

const FILES = import.meta.glob<StarterTexts>('../i18n/starters/*.json', {
  import: 'default',
});

/** The starting texts in `language` — English for one without a file. */
export function loadStarterTexts(language: string): Promise<StarterTexts> {
  const load =
    FILES[`../i18n/starters/${language}.json`] ?? FILES['../i18n/starters/en.json'];
  return load();
}
