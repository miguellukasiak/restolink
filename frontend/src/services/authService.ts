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

/** POST /api/v1/auth/admin/login — the hidden super-admin door. */
export async function adminLogin(password: string): Promise<AdminSession> {
  const { data } = await api.post<TokenResponse>('/api/v1/auth/admin/login', {
    password,
  });

  const session: AdminSession = {
    token: data.access_token,
    expiresAt: expiresAtFrom(data.expires_in),
  };
  saveAdminSession(session);
  return session;
}
