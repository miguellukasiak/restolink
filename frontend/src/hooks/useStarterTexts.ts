import { useQuery } from '@tanstack/react-query';
import { loadStarterTexts, type StarterTexts } from '../constants/starterTexts';
import { useRestaurantInfo } from './useRestaurantInfo';

/** The starting texts in `language`, once loaded (a small local file). */
export function useStarterTexts(language: string | undefined): StarterTexts | undefined {
  return useQuery({
    queryKey: ['starter-texts', language],
    queryFn: () => loadStarterTexts(language ?? 'pl'),
    enabled: Boolean(language),
    staleTime: Infinity,
    gcTime: Infinity,
  }).data;
}

/** The starting texts in the language this restaurant's menu is written in. */
export function useMenuStarterTexts(restaurantId: string): StarterTexts | undefined {
  return useStarterTexts(useRestaurantInfo(restaurantId).data?.base_language);
}
