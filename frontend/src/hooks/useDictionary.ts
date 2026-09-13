import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  autoTranslate,
  fetchDictionary,
  saveDictionary,
  type DictionaryEntry,
} from '../services/dictionaryService';

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
  });
}

/** Saves the owner's edits and refreshes the screen from the server's answer. */
export function useSaveDictionary(restaurantId: string, targetLang: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entries: DictionaryEntry[]) =>
      saveDictionary(restaurantId, targetLang, entries),
    onSuccess: (data) => {
      // The PUT returns the rebuilt dictionary, so seed the cache with it
      // instead of refetching what we were just handed.
      queryClient.setQueryData(
        dictionaryQueryKeys.forLanguage(restaurantId, targetLang),
        data,
      );
      // The public menu in this language now reads differently.
      void queryClient.invalidateQueries({ queryKey: ['public-menu', restaurantId] });
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
    mutationFn: (texts: string[]) =>
      autoTranslate(restaurantId, targetLang, texts),
  });
}
