import type { MenuNote } from '../types';

/** One section of the menu, top to bottom: a category or a note. */
export type MenuSection<C> =
  | { kind: 'category'; id: string; category: C }
  | { kind: 'note'; id: string; note: MenuNote };

/**
 * Categories and notes in the order a guest reads them.
 *
 * Both carry `order` from one shared numbering; on a tie the category comes
 * first, as the server has it (`menu_layout` in models.py). The sort is
 * stable, so each list's own order settles anything else.
 */
export function menuSections<C extends { id: string; order: number }>(
  categories: readonly C[],
  notes: readonly MenuNote[] = [],
): MenuSection<C>[] {
  const sections: MenuSection<C>[] = [
    ...categories.map((category) => ({
      kind: 'category' as const,
      id: category.id,
      category,
    })),
    ...notes.map((note) => ({ kind: 'note' as const, id: note.id, note })),
  ];
  const rank = (section: MenuSection<C>) =>
    section.kind === 'category' ? section.category.order : section.note.order;
  return sections.sort(
    (a, b) => rank(a) - rank(b) || Number(a.kind === 'note') - Number(b.kind === 'note'),
  );
}

/**
 * Numbers the sections 1…n in the order given and splits them back into the
 * two lists, so the board's copies agree with what the server will store.
 */
export function renumber<C extends { order: number }>(
  sections: readonly MenuSection<C>[],
): { categories: C[]; notes: MenuNote[] } {
  const categories: C[] = [];
  const notes: MenuNote[] = [];
  sections.forEach((section, index) => {
    if (section.kind === 'category') {
      categories.push({ ...section.category, order: index + 1 });
    } else {
      notes.push({ ...section.note, order: index + 1 });
    }
  });
  return { categories, notes };
}
