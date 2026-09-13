import { api } from './api';
import type { PublicMenuResponse } from '../types';

/**
 * GET /api/v1/public/restaurants/{restaurantId}/menu — full public menu + theme.
 *
 * `lang` asks the API to serve the menu's own text — category names, dish
 * names, descriptions, ingredients — in that language. The backend answers from
 * its translation cache and never blocks on a translation service, so this is
 * exactly as fast in German as in Polish. When something is not cached yet the
 * response carries `translation.pending`, and the caller refetches shortly
 * after (see `usePublicMenu`).
 *
 * Omitted, or set to the menu's own language, it returns the original wording.
 */
export async function fetchPublicMenu(
  restaurantId: string,
  lang?: string,
): Promise<PublicMenuResponse> {
  const { data } = await api.get<PublicMenuResponse>(
    `/api/v1/public/restaurants/${restaurantId}/menu`,
    { params: lang ? { lang } : undefined },
  );
  return {
    ...data,
    categories: [...data.categories].sort((a, b) => a.order - b.order),
  };
}
