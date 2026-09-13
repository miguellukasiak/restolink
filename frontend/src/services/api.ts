import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import {
  clearAdminSession,
  clearRestaurantSession,
  getAdminSession,
  getRestaurantSession,
} from './authStorage';

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

/**
 * Which session, if any, a given API path is authenticated by.
 *
 * The two tokens are kept apart rather than sending "whatever we have": the
 * backend rejects a restaurant token on an admin route and vice versa, and
 * sending the admin token to an owner endpoint would leak the far more
 * powerful credential to a request that has no business seeing it.
 */
function sessionScopeFor(url: string | undefined): 'admin' | 'restaurant' | null {
  if (!url) return null;
  if (url.startsWith('/api/v1/admin')) return 'admin';
  // Two prefixes, both the owner's own data: `/restaurants` for the menu and
  // theme, `/panel` for the translation dictionary and the Google reviews
  // dashboard. Matching on prefixes means a route added under a *third* one
  // silently loses its token — which is how the dictionary first shipped a
  // 401 — so add any new owner prefix here.
  if (
    url.startsWith('/api/v1/restaurants') ||
    url.startsWith('/api/v1/panel')
  ) {
    return 'restaurant';
  }
  // `/api/v1/auth/*` and `/api/v1/public/*` are deliberately unauthenticated.
  return null;
}

/** Attaches the bearer token that matches the endpoint being called. */
api.interceptors.request.use((config) => {
  const scope = sessionScopeFor(config.url);
  if (!scope) return config;

  const token =
    scope === 'admin' ? getAdminSession()?.token : getRestaurantSession()?.token;

  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

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

    handleExpiredSession(error);

    return Promise.reject(error);
  },
);

/**
 * A 401 from a protected endpoint means the token is gone, expired or was
 * revoked server-side — the account was blocked or deleted while the session
 * was still live. Drop the stale credential and send the user to the right
 * login screen.
 *
 * A 401 from `/api/v1/auth/*` is *not* this: it is the normal "wrong password"
 * answer, and bouncing the page would throw away the error the form is about
 * to display.
 */
function handleExpiredSession(error: AxiosError): void {
  if (error.response?.status !== 401) return;

  const scope = sessionScopeFor(error.config?.url);
  if (!scope) return;

  if (scope === 'admin') {
    clearAdminSession();
    redirectToLogin('/hq-access');
  } else {
    clearRestaurantSession();
    redirectToLogin('/login');
  }
}

function redirectToLogin(path: string): void {
  if (window.location.pathname === path) return;

  // The interceptor lives outside the Router, so navigation goes through the
  // browser. `next` lets the login screen return the user where they were.
  const next = encodeURIComponent(
    window.location.pathname + window.location.search,
  );
  window.location.replace(`${path}?next=${next}`);
}

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
