import { useMutation } from '@tanstack/react-query';
import { updateMenuCategory } from '../services/menuService';
import { writesTo } from '../services/cacheSync';

interface UpdateCategoryVariables {
  categoryId: string;
  name: string;
}

/** Renames a category and refreshes the restaurant's menu on success. */
export function useUpdateCategory(restaurantId: string) {
  return useMutation({
    mutationFn: ({ categoryId, name }: UpdateCategoryVariables) =>
      updateMenuCategory(restaurantId, categoryId, name),
    // Refreshes the builder, the previews, "Languages" and the guest menu.
    meta: writesTo(restaurantId, ['menu']),
  });
}
