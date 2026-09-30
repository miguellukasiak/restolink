import { useMutation } from '@tanstack/react-query';
import { deleteMenuCategory } from '../services/menuService';
import { writesTo } from '../services/cacheSync';

/** Soft-deletes a category (and its dishes) and refreshes the menu. */
export function useDeleteCategory(restaurantId: string) {
  return useMutation({
    mutationFn: (categoryId: string) => deleteMenuCategory(restaurantId, categoryId),
    // Refreshes the builder, the previews, "Languages" and the guest menu.
    meta: writesTo(restaurantId, ['menu']),
  });
}
