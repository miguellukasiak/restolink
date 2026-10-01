import type { MenuCategory, MenuItem } from '../types';
import type { UntranslatedPhrase } from '../services/languagesService';

type DishText = Pick<
  MenuItem,
  'name' | 'description' | 'ingredients' | 'allergens' | 'tags'
>;

/**
 * Everything the owner wrote on a dish, as `dish_texts()` in
 * backend/app/translation_service.py lists it. Built-in allergens and tags
 * are never among the untranslated phrases, so looking them up is harmless.
 */
export function dishTexts(dish: DishText): string[] {
  return [dish.name, dish.description, dish.ingredients, ...dish.allergens, ...dish.tags];
}

/** Translations still to write: one per phrase and offered language lacking it. */
export function missingTranslations(untranslated: UntranslatedPhrase[] = []): number {
  return untranslated.reduce((sum, phrase) => sum + phrase.languages.length, 0);
}

/**
 * What these texts still need, language by language: the owner's order of
 * languages, the menu's order of phrases. Empty when nothing is missing.
 */
export function gapsFor(
  texts: Iterable<string>,
  untranslated: UntranslatedPhrase[] = [],
): Map<string, string[]> {
  const wanted = new Set(texts);
  const gaps = new Map<string, string[]>();
  for (const phrase of untranslated) {
    if (!wanted.has(phrase.text)) continue;
    for (const code of phrase.languages) {
      gaps.set(code, [...(gaps.get(code) ?? []), phrase.text]);
    }
  }
  return gaps;
}

/**
 * The texts a save brought onto the menu: all of a new dish's, and of an
 * edited one only what changed. A new price asks for no translation.
 */
export function introducedTexts(saved: DishText, before: DishText | null): string[] {
  const had = new Set(before ? dishTexts(before) : []);
  return dishTexts(saved).filter((text) => text.trim() !== '' && !had.has(text));
}

/** Dishes at least one offered language cannot read in full. */
export function untranslatedDishes(
  categories: MenuCategory[],
  untranslated: UntranslatedPhrase[] = [],
): number {
  const missing = new Set(untranslated.map((phrase) => phrase.text));
  if (missing.size === 0) return 0;
  return categories
    .flatMap((category) => category.items)
    .filter((dish) => dishTexts(dish).some((text) => missing.has(text))).length;
}
