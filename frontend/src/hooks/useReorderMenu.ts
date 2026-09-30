import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reorderMenu } from '../services/menuService';
import type { MenuCategory, MenuNote } from '../types';
import { menuQueryKeys } from './useMenu';
import { writesTo } from '../services/cacheSync';

interface Board {
  /** Numbered in one sequence with the notes (utils/menuLayout.ts). */
  categories: MenuCategory[];
  notes: MenuNote[];
}

/**
 * Persists the builder's layout after a drag.
 *
 * The board moves the rows itself the instant they are dropped; this only
 * tells the server. On success the cache takes the new layout directly rather
 * than re-reading the menu — but only from the last of several quick drags:
 * an earlier one landing would otherwise hand the board a layout the owner has
 * already moved past, and the rows would visibly jump back and forth.
 */
export function useReorderMenu(restaurantId: string) {
  const queryClient = useQueryClient();
  const mutationKey = ['menu', 'reorder', restaurantId] as const;
  const boardKeys = [
    menuQueryKeys.categories(restaurantId),
    menuQueryKeys.notes(restaurantId),
  ];

  return useMutation({
    mutationKey,
    mutationFn: ({ categories, notes }: Board) =>
      reorderMenu(restaurantId, categories, notes),
    // The builder's own lists are left alone: re-reading them mid-gesture is
    // the jump described above. Everything else showing the menu refreshes.
    meta: writesTo(restaurantId, ['menu'], boardKeys),
    onSuccess: (_data, { categories, notes }) => {
      // Still counted as pending while its own callbacks run, so 1 means
      // "this is the only one left".
      if (queryClient.isMutating({ mutationKey }) > 1) return;
      queryClient.setQueryData(menuQueryKeys.categories(restaurantId), categories);
      queryClient.setQueryData(menuQueryKeys.notes(restaurantId), notes);
    },
    onError: () => {
      // The board may now show an order the server refused; re-read the truth.
      for (const queryKey of boardKeys) void queryClient.invalidateQueries({ queryKey });
    },
  });
}
