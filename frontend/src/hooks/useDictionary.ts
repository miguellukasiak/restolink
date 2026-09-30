import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  autoTranslate,
  fetchDictionary,
  saveDictionary,
  type DictionaryEntry,
} from '../services/dictionaryService';
import { writesTo } from '../services/cacheSync';

export const dictionaryQueryKeys = {
  /** Prefix matching every language's dictionary for one restaurant. */
  all: (restaurantId: string) => ['dictionary', restaurantId] as const,
  forLanguage: (restaurantId: string, targetLang: string) =>
    ['dictionary', restaurantId, targetLang] as const,
};

/** The menu's phrases plus the owner's translations for one language. */
export function useDictionary(restaurantId: string, targetLang: string) {
  return useQuery({
    queryKey: dictionaryQueryKeys.forLanguage(restaurantId, targetLang),
    queryFn: () => fetchDictionary(restaurantId, targetLang),
    enabled: Boolean(restaurantId && targetLang),
    // The phrases are the menu's own text.
    meta: { reads: ['menu', 'dictionary'] },
  });
}

/** Saves the owner's edits and refreshes the screen from the server's answer. */
export function useSaveDictionary(restaurantId: string, targetLang: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entries: DictionaryEntry[]) =>
      saveDictionary(restaurantId, targetLang, entries),
    // The guest menu now reads differently and "Languages" counts translated
    // phrases; this language's dictionary is seeded from the response below.
    meta: writesTo(
      restaurantId,
      ['dictionary'],
      [dictionaryQueryKeys.forLanguage(restaurantId, targetLang)],
    ),
    onSuccess: (data) => {
      // The PUT returns the rebuilt dictionary, so seed the cache with it
      // instead of refetching what we were just handed.
      queryClient.setQueryData(
        dictionaryQueryKeys.forLanguage(restaurantId, targetLang),
        data,
      );
    },
  });
}

/**
 * Requests machine drafts. Deliberately *not* a query: it has side effects
 * upstream, takes tens of seconds, and its result is a proposal the owner
 * edits rather than server state to cache.
 */
export function useAutoTranslate(restaurantId: string, targetLang: string) {
  return useMutation({
    mutationFn: (texts: string[]) => autoTranslate(restaurantId, targetLang, texts),
  });
}
