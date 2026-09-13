import { api } from './api';

/** One menu phrase and the owner's translation of it. */
export interface DictionaryEntry {
  original_text: string;
  translated_text: string;
}

export interface DictionaryResponse {
  target_lang: string;
  base_language: string;
  entries: DictionaryEntry[];
}

export interface AutoTranslateResponse {
  target_lang: string;
  entries: DictionaryEntry[];
  /** Phrases the translator could not draft; the owner writes these by hand. */
  failed: string[];
}

const base = (restaurantId: string) =>
  `/api/v1/panel/${restaurantId}/dictionary`;

/**
 * GET — every distinct phrase in the menu, paired with whatever the owner has
 * already translated into `targetLang`.
 *
 * Built from the live menu server-side, so a dish renamed yesterday shows up
 * today and a deleted one does not.
 */
export async function fetchDictionary(
  restaurantId: string,
  targetLang: string,
): Promise<DictionaryResponse> {
  const { data } = await api.get<DictionaryResponse>(base(restaurantId), {
    params: { target_lang: targetLang },
  });
  return data;
}

/** PUT — stores the owner's translations. A blank one deletes its entry. */
export async function saveDictionary(
  restaurantId: string,
  targetLang: string,
  entries: DictionaryEntry[],
): Promise<DictionaryResponse> {
  const { data } = await api.put<DictionaryResponse>(base(restaurantId), {
    target_lang: targetLang,
    entries,
  });
  return data;
}

/**
 * POST — machine drafts for the owner to review. **Nothing is saved.**
 *
 * The backend makes these one at a time with a delay, so a long list takes a
 * while; the caller is expected to show a spinner. The 30s default timeout on
 * the shared axios instance is far too short for that, hence the override.
 */
export async function autoTranslate(
  restaurantId: string,
  targetLang: string,
  texts: string[],
): Promise<AutoTranslateResponse> {
  const { data } = await api.post<AutoTranslateResponse>(
    `${base(restaurantId)}/auto-translate`,
    { target_lang: targetLang, texts },
    { timeout: 210_000 },
  );
  return data;
}
