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

/** One-tap names offered when adding a category: the sections most menus have. */
export const CATEGORY_SUGGESTIONS = [
  'Przystawki',
  'Zupy',
  'Sałatki',
  'Dania główne',
  'Makarony',
  'Pizza',
  'Burgery',
  'Desery',
  'Napoje',
  'Kawa i herbata',
] as const;

/** The skeleton an empty menu can be started from in one click. */
export const STARTER_CATEGORIES = ['Przystawki', 'Dania główne', 'Desery', 'Napoje'] as const;

/**
 * Starting points for a note between the menu's sections, in the menu's own
 * language like the category names above. The owner edits the hours and
 * amounts; the panel names each one through `noteDialog.templates.<key>`.
 */
export const NOTE_TEMPLATES = [
  {
    key: 'lunch',
    body:
      'Menu obiadowe podajemy od poniedziałku do piątku w godzinach 12:00–16:00.\n' +
      'Zestaw: zupa + danie dnia.',
  },
  {
    key: 'allergies',
    body: 'Masz alergię lub nietolerancję pokarmową? Powiedz obsłudze — chętnie doradzimy.',
  },
  {
    key: 'waitingTime',
    body: 'Wszystkie dania przygotowujemy na bieżąco, dlatego czas oczekiwania może się wydłużyć.',
  },
  {
    key: 'service',
    body: 'Do rachunku dla grup od 8 osób doliczamy 10% serwisu.',
  },
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

/** The currency's sign, as the menu's prices write it. */
export const CURRENCY_SYMBOL = 'zł';

/** Formats a price in PLN with Polish conventions (e.g. "24,90 zł"). */
export function formatPln(value: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
  }).format(value);
}
