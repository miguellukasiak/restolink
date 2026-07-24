import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createRestaurant } from '../services/restaurantService';
import { restaurantsQueryKeys } from './useRestaurants';
import type { CreateRestaurantRequest } from '../types';

/**
 * Creates a restaurant account and, on success, invalidates every restaurants
 * list query so the DataGrid picks up the new record immediately.
 */
export function useAddRestaurant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateRestaurantRequest) => createRestaurant(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: restaurantsQueryKeys.all });
    },
  });
}
