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
    staleTime: 30_000,
  });
}
