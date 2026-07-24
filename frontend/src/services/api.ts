import axios, { AxiosError } from 'axios';

/**
 * Shared Axios instance pointed at the FastAPI backend.
 *
 * The base URL comes from the `VITE_API_URL` build-time env var (set in Vercel
 * for production); it falls back to the local Docker backend for development.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
});

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
      return 'Przekroczono limit czasu żądania. Spróbuj ponownie.';
    }
    if (!axiosError.response) {
      return 'Brak połączenia z serwerem. Sprawdź, czy backend działa.';
    }
  }

  if (error instanceof Error && error.message) return error.message;
  return 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.';
}
