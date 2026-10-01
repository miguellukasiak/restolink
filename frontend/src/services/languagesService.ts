import { api } from './api';

export interface LanguageProgress {
  code: string;
  /** Phrases of the current menu translated into this language. */
  translated: number;
}

export interface MenuLanguagesResponse {
  base_language: string;
  /** Where the restaurant is: the map's pin and the recommendations. */
  country?: string;
  /** Offered to guests besides the base language, in the owner's order. */
  languages: string[];
  /** The whole catalogue the owner can pick from. */
  available: string[];
  /** Distinct phrases on the menu right now. */
  phrases_total: number;
  /** Offered languages, plus any other with work in it. */
  progress: LanguageProgress[];
}

const base = (restaurantId: string) => `/api/v1/panel/${restaurantId}/languages`;

export async function fetchMenuLanguages(
  restaurantId: string,
): Promise<MenuLanguagesResponse> {
  const { data } = await api.get<MenuLanguagesResponse>(base(restaurantId));
  return data;
}

/** Replaces the offered languages. Translations are never touched. */
export async function saveMenuLanguages(
  restaurantId: string,
  languages: string[],
): Promise<MenuLanguagesResponse> {
  const { data } = await api.put<MenuLanguagesResponse>(base(restaurantId), {
    languages,
  });
  return data;
}
