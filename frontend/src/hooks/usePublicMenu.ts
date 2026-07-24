import { useQuery } from '@tanstack/react-query';
import { fetchPublicMenu } from '../services/publicMenuService';

export const publicMenuQueryKeys = {
  menu: (restaurantId: string) => ['public-menu', restaurantId] as const,
};

/**
 * Full public menu with theme settings. Shared by RestaurantThemeProvider and
 * PublicMenuPage — React Query deduplicates the request between them.
 */
export function usePublicMenu(restaurantId: string) {
  return useQuery({
    queryKey: publicMenuQueryKeys.menu(restaurantId),
    queryFn: () => fetchPublicMenu(restaurantId),
    enabled: Boolean(restaurantId),
    staleTime: 60_000,
  });
}
