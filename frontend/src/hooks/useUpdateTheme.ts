import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateRestaurantTheme } from '../services/menuService';
import { publicMenuQueryKeys } from './usePublicMenu';
import type { RestaurantThemeUpdate } from '../types';

/**
 * Saves the restaurant's visual settings and refreshes the public menu query
 * so the live public page (and the settings preview baseline) pick them up.
 */
export function useUpdateTheme(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RestaurantThemeUpdate) =>
      updateRestaurantTheme(restaurantId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: publicMenuQueryKeys.menu(restaurantId),
      });
    },
  });
}
