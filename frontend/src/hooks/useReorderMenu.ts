import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reorderMenu } from '../services/menuService';
import type { MenuCategory } from '../types';
import { menuQueryKeys } from './useMenu';

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

  return useMutation({
    mutationKey,
    mutationFn: (categories: MenuCategory[]) => reorderMenu(restaurantId, categories),
    onSuccess: (_data, categories) => {
      // Still counted as pending while its own callbacks run, so 1 means
      // "this is the only one left".
      if (queryClient.isMutating({ mutationKey }) > 1) return;
      queryClient.setQueryData<MenuCategory[]>(
        menuQueryKeys.categories(restaurantId),
        categories.map((category, index) => ({ ...category, order: index + 1 })),
      );
    },
    onError: () => {
      // The board may now show an order the server refused; re-read the truth.
      void queryClient.invalidateQueries({
        queryKey: menuQueryKeys.categories(restaurantId),
      });
    },
  });
}
