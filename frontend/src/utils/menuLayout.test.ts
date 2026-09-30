import { describe, expect, it } from 'vitest';
import { menuSections, renumber } from './menuLayout';

const category = (id: string, order: number) => ({ id, order });
const note = (id: string, order: number) => ({ id, order, body: id });

describe('the menu layout', () => {
  it('interleaves notes among categories by their shared numbering', () => {
    const sections = menuSections(
      [category('soups', 2), category('mains', 4)],
      [note('hours', 1), note('set', 3), note('vat', 9)],
    );
    expect(sections.map((section) => section.id)).toEqual([
      'hours',
      'soups',
      'set',
      'mains',
      'vat',
    ]);
  });

  it('puts the category first on a tie, as the server does', () => {
    const sections = menuSections([category('soups', 1)], [note('hours', 1)]);
    expect(sections.map((section) => section.kind)).toEqual(['category', 'note']);
  });

  it('numbers a dragged board again and splits it back', () => {
    const [soups, hours, mains] = menuSections(
      [category('soups', 1), category('mains', 3)],
      [note('hours', 2)],
    );
    const { categories, notes } = renumber([hours, mains, soups]);
    expect(notes).toEqual([note('hours', 1)]);
    expect(categories).toEqual([category('mains', 2), category('soups', 3)]);
    // And reading it back gives the dragged order.
    expect(menuSections(categories, notes).map((section) => section.id)).toEqual([
      'hours',
      'mains',
      'soups',
    ]);
  });
});
