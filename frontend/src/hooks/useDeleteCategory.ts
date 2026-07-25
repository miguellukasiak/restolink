import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteMenuCategory } from '../services/menuService';
import { menuQueryKeys } from './useMenu';

/** Soft-deletes a category (and its dishes) and refreshes the menu. */
export function useDeleteCategory(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryId: string) =>
      deleteMenuCategory(restaurantId, categoryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: menuQueryKeys.categories(restaurantId),
      });
    },
  });
}
