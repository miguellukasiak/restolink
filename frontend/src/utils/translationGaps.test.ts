import { describe, expect, it } from 'vitest';
import type { MenuCategory, MenuItem } from '../types';
import {
  dishTexts,
  gapsFor,
  introducedTexts,
  missingTranslations,
  untranslatedDishes,
} from './translationGaps';

const dish = (name: string, extra: Partial<MenuItem> = {}): MenuItem => ({
  id: name,
  category_id: 'c',
  name,
  price: 10,
  description: '',
  ingredients: '',
  allergens: [],
  tags: [],
  is_available: true,
  image_url: null,
  ...extra,
});

const untranslated = [
  { text: 'Zupy', languages: ['en'] },
  { text: 'Żurek', languages: ['en'] },
  { text: 'Na zakwasie', languages: ['de', 'en'] },
  { text: 'Sezam', languages: ['de'] },
];

describe('the gaps in a menu’s translations', () => {
  it('counts one translation per phrase and language', () => {
    expect(missingTranslations(untranslated)).toBe(5);
    expect(missingTranslations([])).toBe(0);
    expect(missingTranslations(undefined)).toBe(0);
  });

  it('reads a dish’s own texts and labels, as the server lists them', () => {
    expect(
      dishTexts(
        dish('Żurek', { description: 'Na zakwasie', allergens: ['Gluten', 'Sezam'] }),
      ),
    ).toEqual(['Żurek', 'Na zakwasie', '', 'Gluten', 'Sezam']);
  });

  it('gives the gaps per language, in the owner’s order', () => {
    const zurek = dish('Żurek', { description: 'Na zakwasie', allergens: ['Sezam'] });
    expect([...gapsFor(dishTexts(zurek), untranslated)]).toEqual([
      ['en', ['Żurek', 'Na zakwasie']],
      ['de', ['Na zakwasie', 'Sezam']],
    ]);
    expect(gapsFor(['Pierogi'], untranslated).size).toBe(0);
  });

  it('asks about what a save brought, not what was already there', () => {
    const before = dish('Żurek', { description: 'Na zakwasie' });
    expect(introducedTexts(before, null)).toEqual(['Żurek', 'Na zakwasie']);
    expect(introducedTexts({ ...before, price: 30 } as MenuItem, before)).toEqual([]);
    expect(
      introducedTexts({ ...before, description: 'Z jajkiem', tags: ['Ostre'] }, before),
    ).toEqual(['Z jajkiem', 'Ostre']);
  });

  it('counts the dishes a guest cannot read in full', () => {
    const categories: MenuCategory[] = [
      {
        id: 'c',
        name: 'Zupy',
        order: 0,
        items: [dish('Żurek'), dish('Rosół'), dish('Barszcz', { tags: ['Sezam'] })],
      },
    ];
    // The category's own name is a gap too, but not a dish's.
    expect(untranslatedDishes(categories, untranslated)).toBe(2);
    expect(untranslatedDishes(categories, [])).toBe(0);
  });
});
