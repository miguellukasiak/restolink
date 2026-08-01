import { useQuery } from '@tanstack/react-query';
import { fetchMenuCategories } from '../services/menuService';

export const menuQueryKeys = {
  all: ['menu'] as const,
  categories: (restaurantId: string) => ['menu', 'categories', restaurantId] as const,
};

/** Menu categories (with nested dishes) for one restaurant. */
export function useMenu(restaurantId: string) {
  return useQuery({
    queryKey: menuQueryKeys.categories(restaurantId),
    queryFn: () => fetchMenuCategories(restaurantId),
    enabled: Boolean(restaurantId),
    // staleTime inherited from the global QueryClient default (5 min) so tab
    // navigation is instant; mutations invalidate this key to stay accurate.
  });
}
