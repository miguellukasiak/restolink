import { useMutation } from '@tanstack/react-query';
import { deleteMenuItem } from '../services/menuService';
import { writesTo } from '../services/cacheSync';

/** Soft-deletes a single dish and refreshes the menu. */
export function useDeleteMenuItem(restaurantId: string) {
  return useMutation({
    mutationFn: (itemId: string) => deleteMenuItem(restaurantId, itemId),
    // Refreshes the builder, the previews, "Languages" and the guest menu.
    meta: writesTo(restaurantId, ['menu']),
  });
}
