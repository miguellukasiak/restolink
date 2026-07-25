import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateMenuCategory } from '../services/menuService';
import { menuQueryKeys } from './useMenu';

interface UpdateCategoryVariables {
  categoryId: string;
  name: string;
}

/** Renames a category and refreshes the restaurant's menu on success. */
export function useUpdateCategory(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ categoryId, name }: UpdateCategoryVariables) =>
      updateMenuCategory(restaurantId, categoryId, name),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: menuQueryKeys.categories(restaurantId),
      });
    },
  });
}
