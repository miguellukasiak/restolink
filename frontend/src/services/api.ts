import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

/**
 * Shared Axios instance pointed at the FastAPI backend.
 *
 * The base URL comes from the `VITE_API_URL` build-time env var (set in Vercel
 * for production); it falls back to the local Docker backend for development.
 *
 * Timeout is a generous 30s: the production backend runs on a free-tier Render
 * container that spins down when idle, so the *first* request after a quiet
 * period pays a "cold start" of several seconds while the container boots.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30_000,
});

/** Marks a request config that has already been retried once (see below). */
interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

/** Was this failure a timeout or a total no-response (i.e. a cold start)? */
function isColdStartFailure(error: AxiosError): boolean {
  return error.code === 'ECONNABORTED' || !error.response;
}

/**
 * Cold-start retry: when a **GET** times out or gets no response (the classic
 * "the container was asleep and my request woke it" case), transparently retry
 * it exactly once after a short delay. GETs are idempotent, so replaying them
 * is safe — we deliberately never retry POST/PUT/DELETE to avoid duplicate
 * writes. If the retry also fails, the error propagates to getApiErrorMessage.
 */
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const isGet = (config?.method ?? 'get').toLowerCase() === 'get';

    if (config && isGet && !config._retried && isColdStartFailure(error)) {
      config._retried = true;
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      return api(config);
    }

    return Promise.reject(error);
  },
);

interface FastApiErrorBody {
  detail?: string | Array<{ msg?: string }>;
  message?: string;
}

/**
 * Normalizes any thrown value (FastAPI validation errors, network failures,
 * plain Errors) into a human-readable message for the snackbar.
 */
export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<FastApiErrorBody>;
    const body = axiosError.response?.data;

    if (typeof body?.detail === 'string') return body.detail;
    if (Array.isArray(body?.detail) && body.detail[0]?.msg) return body.detail[0].msg;
    if (typeof body?.message === 'string') return body.message;

    if (axiosError.response?.status === 404) {
      return 'Nie znaleziono restauracji o podanym ID.';
    }
    if (axiosError.response?.status === 400) {
      return 'Błąd walidacji — sprawdź wprowadzone dane.';
    }
    if (axiosError.code === 'ECONNABORTED') {
      return (
        'Serwer się wybudza po okresie bezczynności — pierwsze żądanie może ' +
        'potrwać do 30 sekund. Odczekaj chwilę i spróbuj ponownie.'
      );
    }
    if (!axiosError.response) {
      return 'Brak połączenia z serwerem. Sprawdź połączenie internetowe i spróbuj ponownie.';
    }
  }

  if (error instanceof Error && error.message) return error.message;
  return 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.';
}
