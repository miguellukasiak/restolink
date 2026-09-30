import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateRestaurantTheme } from '../services/menuService';
import { writesTo } from '../services/cacheSync';
import { publicMenuQueryKeys } from './usePublicMenu';
import type { PublicMenuResponse, RestaurantThemeUpdate } from '../types';

/**
 * Saves the restaurant's visual settings.
 *
 * Every cached copy of the menu takes the new look straight away, so the
 * builder's phone, the QR studio and the guest menu show it the moment the
 * owner arrives there — no frame of the old colours while a refetch runs.
 * The refetch that follows (cacheSync) swaps an uploaded logo's data URI for
 * its hosted address.
 */
export function useUpdateTheme(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RestaurantThemeUpdate) =>
      updateRestaurantTheme(restaurantId, payload),
    meta: writesTo(restaurantId, ['theme']),
    onSuccess: (_data, payload) => {
      // The prefix, not one language: the menu is cached per language, and a
      // look applies to every one of them.
      queryClient.setQueriesData<PublicMenuResponse>(
        { queryKey: publicMenuQueryKeys.all(restaurantId) },
        (menu) =>
          menu && {
            ...menu,
            restaurant: {
              ...menu.restaurant,
              theme: { ...menu.restaurant.theme, ...payload },
            },
          },
      );
    },
  });
}
