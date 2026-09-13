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
 * One DeepL call for the whole list, so this returns in about a second. The
 * shared instance's 30s default is plenty; the previous 210s override existed
 * for a free endpoint that had to be fed one phrase at a time with delays
 * between them, and is gone with it.
 */
export async function autoTranslate(
  restaurantId: string,
  targetLang: string,
  texts: string[],
): Promise<AutoTranslateResponse> {
  const { data } = await api.post<AutoTranslateResponse>(
    `${base(restaurantId)}/auto-translate`,
    { target_lang: targetLang, texts },
  );
  return data;
}
