import { api } from './api';
import {
  expiresAtFrom,
  saveAdminSession,
  saveRestaurantSession,
  type AdminSession,
  type RestaurantSession,
} from './authStorage';

/** Shape returned by every token-issuing endpoint. */
interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  restaurant_id?: string | null;
  restaurant_name?: string | null;
}

interface MessageResponse {
  message: string;
}

/**
 * POST /api/v1/auth/login — exchanges email + password for a session.
 *
 * The backend answers identically for an unknown address and a wrong password,
 * so there is deliberately nothing here to tell them apart.
 */
export async function login(
  email: string,
  password: string,
): Promise<RestaurantSession> {
  const { data } = await api.post<TokenResponse>('/api/v1/auth/login', {
    email,
    password,
  });

  const session: RestaurantSession = {
    token: data.access_token,
    expiresAt: expiresAtFrom(data.expires_in),
    restaurantId: data.restaurant_id ?? '',
    restaurantName: data.restaurant_name ?? '',
  };
  saveRestaurantSession(session);
  return session;
}

/**
 * POST /api/v1/auth/forgot-password — requests a reset link.
 *
 * Always resolves when the request itself succeeds, including for addresses
 * that are not registered. The UI must not imply otherwise.
 */
export async function requestPasswordReset(email: string): Promise<string> {
  const { data } = await api.post<MessageResponse>(
    '/api/v1/auth/forgot-password',
    { email },
  );
  return data.message;
}

/** POST /api/v1/auth/reset-password — consumes the emailed token. */
export async function resetPassword(
  token: string,
  password: string,
): Promise<string> {
  const { data } = await api.post<MessageResponse>(
    '/api/v1/auth/reset-password',
    { token, password },
  );
  return data.message;
}

/** The HQ account behind a token. Mirrors the backend `AdminProfile`. */
export interface AdminProfile {
  id: string;
  email: string;
  is_superadmin: boolean;
}

interface AdminTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  admin: AdminProfile;
}

/**
 * Thrown when credentials are valid but the account has no HQ rights.
 *
 * A separate type because it is not a failed sign-in: the person exists and
 * proved it, so the screen offers them the owner panel rather than another
 * attempt at a door that will never open for them.
 */
export class NotASuperadminError extends Error {
  constructor(message = 'Brak uprawnień administracyjnych.') {
    super(message);
    this.name = 'NotASuperadminError';
  }
}

/**
 * POST /api/v1/auth/admin/login — HQ sign-in with individual credentials.
 *
 * This used to take a single shared master password. It now takes the same
 * email and password shape as the owner login, against a separate accounts
 * table, and the server answers 403 for an account without the superadmin
 * flag. The flag is re-checked here before a session is stored — the server is
 * the boundary, but a token that cannot open anything should never be saved.
 */
export async function adminLogin(
  email: string,
  password: string,
): Promise<AdminSession> {
  const { data } = await api.post<AdminTokenResponse>(
    '/api/v1/auth/admin/login',
    { email, password },
  );

  if (!data.admin?.is_superadmin) {
    throw new NotASuperadminError();
  }

  const session: AdminSession = {
    token: data.access_token,
    expiresAt: expiresAtFrom(data.expires_in),
    email: data.admin.email,
  };
  saveAdminSession(session);
  return session;
}

/** GET /api/v1/admin/me — who the stored HQ token belongs to. */
export async function fetchAdminProfile(): Promise<AdminProfile> {
  const { data } = await api.get<AdminProfile>('/api/v1/admin/me');
  return data;
}

/**
 * POST /api/v1/auth/activate — turns a welcome link into a working account.
 *
 * Returns a session, so a new owner lands in their panel instead of being sent
 * to a login form to retype the password they just chose.
 */
export async function activateAccount(
  token: string,
  newPassword: string,
): Promise<RestaurantSession> {
  const { data } = await api.post<TokenResponse>('/api/v1/auth/activate', {
    token,
    new_password: newPassword,
  });

  const session: RestaurantSession = {
    token: data.access_token,
    expiresAt: expiresAtFrom(data.expires_in),
    restaurantId: data.restaurant_id ?? '',
    restaurantName: data.restaurant_name ?? '',
  };
  saveRestaurantSession(session);
  return session;
}
