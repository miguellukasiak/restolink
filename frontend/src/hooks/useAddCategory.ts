import { useMutation } from '@tanstack/react-query';
import { createMenuCategory } from '../services/menuService';
import { writesTo } from '../services/cacheSync';

/** Creates a menu category and refreshes the restaurant's menu on success. */
export function useAddCategory(restaurantId: string) {
  return useMutation({
    mutationFn: (name: string) => createMenuCategory(restaurantId, name),
    // Refreshes the builder, the previews, "Languages" and the guest menu.
    meta: writesTo(restaurantId, ['menu']),
  });
}
