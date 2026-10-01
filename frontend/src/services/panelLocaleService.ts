import axios from 'axios';
import { api } from './api';

/** A panel language DeepL made: its strings, and the English each came from. */
export interface PanelLocale {
  code: string;
  /** Flat keys: "builder.newNote" → text. */
  strings: Record<string, string>;
  sources: Record<string, string>;
}

export interface PanelLocaleStatus {
  code: string;
  /** How many of the panel's strings it has. */
  strings: number;
  updated_at: string;
}

/** GET /api/v1/public/panel-locales/{code} — null while it has not been made. */
export async function fetchPanelLocale(code: string): Promise<PanelLocale | null> {
  try {
    const { data } = await api.get<PanelLocale>(`/api/v1/public/panel-locales/${code}`);
    return data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

/** GET /api/v1/admin/panel-locales — which languages are made (HQ). */
export async function fetchPanelLocaleStatuses(): Promise<PanelLocaleStatus[]> {
  const { data } = await api.get<PanelLocaleStatus[]>('/api/v1/admin/panel-locales');
  return data;
}

/** POST …/{code}/translate — one batch of English, in `code` (HQ; DeepL). */
export async function translateInterface(
  code: string,
  texts: string[],
): Promise<string[]> {
  const { data } = await api.post<{ translations: string[] }>(
    `/api/v1/admin/panel-locales/${code}/translate`,
    { texts },
  );
  return data.translations;
}

/** PUT …/{code} — stores strings; the server makes its messages and emails. */
export async function savePanelLocale(
  code: string,
  strings: Record<string, string>,
  sources: Record<string, string>,
): Promise<PanelLocaleStatus> {
  const { data } = await api.put<PanelLocaleStatus>(
    `/api/v1/admin/panel-locales/${code}`,
    {
      strings,
      sources,
    },
  );
  return data;
}
