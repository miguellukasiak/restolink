import { useQuery } from '@tanstack/react-query';
import { fetchRestaurantPanelInfo } from '../services/menuService';

export const restaurantInfoQueryKeys = {
  detail: (restaurantId: string) => ['restaurant-info', restaurantId] as const,
};

/** Restaurant details used to personalize the panel header. */
export function useRestaurantInfo(restaurantId: string) {
  return useQuery({
    queryKey: restaurantInfoQueryKeys.detail(restaurantId),
    queryFn: () => fetchRestaurantPanelInfo(restaurantId),
    enabled: Boolean(restaurantId),
    staleTime: 5 * 60_000,
  });
}
