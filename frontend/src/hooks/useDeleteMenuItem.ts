import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteMenuItem } from '../services/menuService';
import { menuQueryKeys } from './useMenu';

/** Soft-deletes a single dish and refreshes the menu. */
export function useDeleteMenuItem(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => deleteMenuItem(restaurantId, itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: menuQueryKeys.categories(restaurantId),
      });
    },
  });
}
