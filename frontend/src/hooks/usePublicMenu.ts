import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchPublicMenu } from '../services/publicMenuService';

export const publicMenuQueryKeys = {
  /** Prefix matching every language's copy of one restaurant's menu. */
  all: (restaurantId: string) => ['public-menu', restaurantId] as const,
  menu: (restaurantId: string, lang: string) =>
    ['public-menu', restaurantId, lang] as const,
};

/**
 * Full public menu with theme settings, in the guest's language.
 *
 * Shared by RestaurantThemeProvider and PublicMenuPage — React Query
 * deduplicates the request between them. The language is part of the query key,
 * so switching language is a normal cache miss rather than something the hook
 * has to orchestrate.
 */
export function usePublicMenu(restaurantId: string) {
  const { i18n } = useTranslation();
  // Always the base code: `de-AT` and `de` must not become two cache entries
  // holding identical data, on either side of the wire.
  const lang = (i18n.resolvedLanguage ?? i18n.language ?? 'pl').split('-')[0] ?? 'pl';

  return useQuery({
    queryKey: publicMenuQueryKeys.menu(restaurantId, lang),
    queryFn: () => fetchPublicMenu(restaurantId, lang),
    enabled: Boolean(restaurantId),
    // No polling: translations come from the owner's dictionary and are
    // complete the moment the menu is served. The old interval existed only to
    // wait out a background machine-translation pass, which no longer exists.
    // staleTime inherited from the global QueryClient default (5 min); the theme
    // save (useUpdateTheme) invalidates this key so the preview stays in sync.
  });
}
