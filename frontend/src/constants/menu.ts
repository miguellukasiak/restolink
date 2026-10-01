/** Allergen checklist shown in the dish editor. */
export const ALLERGEN_OPTIONS = [
  'Gluten',
  'Laktoza',
  'Orzechy',
  'Jaja',
  'Soja',
  'Ryby',
  'Seler',
  'Gorczyca',
] as const;

/** Marketing / dietary tags shown in the dish editor. */
export const TAG_OPTIONS = [
  'Wegańskie',
  'Wegetariańskie',
  'Bestseller',
  'Pikantne',
  'Nowość',
] as const;

/**
 * Starting points for a note between the menu's sections, each with the icon
 * that suits it. Their text is in the menu's own language, from its starter
 * texts (`notes.<key>`, constants/starterTexts.ts); the panel names each one
 * through `noteDialog.templates.<key>`.
 */
export const NOTE_TEMPLATES = [
  { key: 'lunch', icon: 'clock' },
  { key: 'allergies', icon: 'allergy' },
  { key: 'waitingTime', icon: 'fire' },
  { key: 'service', icon: 'info' },
] as const;

export const NOTE_MAX_LENGTH = 1000;

export type MenuAllergen = (typeof ALLERGEN_OPTIONS)[number];
export type MenuTag = (typeof TAG_OPTIONS)[number];

/*
 * Public-menu i18n keys for the fixed vocabularies.
 *
 * Allergens and tags are stored as their Polish label — the owner panel shows
 * them verbatim, and the API passes them through untranslated — so the
 * guest-facing menu maps each stored value to a stable key instead of using
 * Polish text as the key itself. Filtering and icons keep using the stored
 * value; only what the guest reads is translated.
 */

const ALLERGEN_I18N_KEYS: Record<MenuAllergen, string> = {
  Gluten: 'allergenGluten',
  Laktoza: 'allergenLactose',
  Orzechy: 'allergenNuts',
  Jaja: 'allergenEggs',
  Soja: 'allergenSoy',
  Ryby: 'allergenFish',
  Seler: 'allergenCelery',
  Gorczyca: 'allergenMustard',
};

const TAG_I18N_KEYS: Record<MenuTag, string> = {
  Wegańskie: 'tagVegan',
  Wegetariańskie: 'tagVegetarian',
  Bestseller: 'tagBestseller',
  Pikantne: 'tagSpicy',
  Nowość: 'tagNew',
};

function lookupKey(keys: Readonly<Record<string, string>>, value: string): string | null {
  return Object.hasOwn(keys, value) ? (keys[value] ?? null) : null;
}

/** The i18n key for a stored allergen, or `null` for one outside the fixed
 *  vocabulary — which callers show as stored rather than blank. */
export function getAllergenI18nKey(allergen: string): string | null {
  return lookupKey(ALLERGEN_I18N_KEYS, allergen);
}

/** The i18n key for a stored tag, or `null` for one outside the fixed
 *  vocabulary — which callers show as stored rather than blank. */
export function getTagI18nKey(tag: string): string | null {
  return lookupKey(TAG_I18N_KEYS, tag);
}
