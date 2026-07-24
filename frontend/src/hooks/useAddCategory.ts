import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createMenuCategory } from '../services/menuService';
import { menuQueryKeys } from './useMenu';

/** Creates a menu category and refreshes the restaurant's menu on success. */
export function useAddCategory(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => createMenuCategory(restaurantId, name),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: menuQueryKeys.categories(restaurantId),
      });
    },
  });
}
