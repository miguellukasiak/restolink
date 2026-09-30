import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchMenuLanguages,
  saveMenuLanguages,
  type MenuLanguagesResponse,
} from '../services/languagesService';
import { writesTo } from '../services/cacheSync';

export const menuLanguagesQueryKey = (restaurantId: string) =>
  ['menu-languages', restaurantId] as const;

/** The offered languages, the catalogue and each language's progress. */
export function useMenuLanguages(restaurantId: string) {
  return useQuery({
    queryKey: menuLanguagesQueryKey(restaurantId),
    queryFn: () => fetchMenuLanguages(restaurantId),
    enabled: Boolean(restaurantId),
    // Progress counts the menu's phrases and the ones translated.
    meta: { reads: ['menu', 'languages', 'dictionary'] },
  });
}

/**
 * Switches languages on or off. Optimistic: the map and the reach figure move
 * the moment the owner clicks, and roll back if the server refuses.
 */
export function useSaveMenuLanguages(restaurantId: string) {
  const queryClient = useQueryClient();
  const key = menuLanguagesQueryKey(restaurantId);

  return useMutation({
    mutationFn: (languages: string[]) => saveMenuLanguages(restaurantId, languages),
    // The guest menu's switcher lists the offered languages; this screen keeps
    // its own answer from the response below.
    meta: writesTo(restaurantId, ['languages'], [key]),
    onMutate: async (languages) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MenuLanguagesResponse>(key);
      if (previous) {
        queryClient.setQueryData<MenuLanguagesResponse>(key, {
          ...previous,
          languages,
          progress: [
            ...previous.progress,
            ...languages
              .filter((code) => !previous.progress.some((entry) => entry.code === code))
              .map((code) => ({ code, translated: 0 })),
          ],
        });
      }
      return { previous };
    },
    onError: (_error, _languages, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(key, data);
    },
  });
}
