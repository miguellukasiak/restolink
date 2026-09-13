/**
 * Session storage for the two independent logins: a restaurant owner and the
 * super-admin.
 *
 * They are kept under separate keys rather than one "current user" slot,
 * because they are genuinely different sessions with different lifetimes — and
 * signing out of one must not silently sign you out of the other.
 *
 * Every access is wrapped: `localStorage` throws outright in some privacy
 * modes, and a storage failure should log the user out, never crash the app.
 */

const RESTAURANT_KEY = 'restolink.auth.restaurant';
const ADMIN_KEY = 'restolink.auth.admin';

/** Treat a session as expired slightly early, so a token cannot die mid-request. */
const EXPIRY_SKEW_MS = 30_000;

export interface RestaurantSession {
  token: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  restaurantId: string;
  restaurantName: string;
}

export interface AdminSession {
  token: string;
  expiresAt: number;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable or full. The session simply will not survive a
    // reload; the current page keeps working from the in-memory response.
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to do — if we cannot clear it, the expiry check still applies.
  }
}

export function expiresAtFrom(expiresInSeconds: number): number {
  return Date.now() + expiresInSeconds * 1000;
}

function isLive(expiresAt: number | undefined): boolean {
  return typeof expiresAt === 'number' && expiresAt - EXPIRY_SKEW_MS > Date.now();
}

/* -------------------------------------------------------------------------- */
/* Restaurant owner                                                            */
/* -------------------------------------------------------------------------- */

export function getRestaurantSession(): RestaurantSession | null {
  const session = read<RestaurantSession>(RESTAURANT_KEY);
  if (!session?.token || !isLive(session.expiresAt)) {
    // Expired or malformed: drop it now so nothing downstream has to re-check.
    if (session) remove(RESTAURANT_KEY);
    return null;
  }
  return session;
}

export function saveRestaurantSession(session: RestaurantSession): void {
  write(RESTAURANT_KEY, session);
}

export function clearRestaurantSession(): void {
  remove(RESTAURANT_KEY);
}

/* -------------------------------------------------------------------------- */
/* Super-admin                                                                 */
/* -------------------------------------------------------------------------- */

export function getAdminSession(): AdminSession | null {
  const session = read<AdminSession>(ADMIN_KEY);
  if (!session?.token || !isLive(session.expiresAt)) {
    if (session) remove(ADMIN_KEY);
    return null;
  }
  return session;
}

export function saveAdminSession(session: AdminSession): void {
  write(ADMIN_KEY, session);
}

export function clearAdminSession(): void {
  remove(ADMIN_KEY);
}
