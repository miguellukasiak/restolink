import { api } from './api';
import type { PaginationMeta } from '../types';

/** An HQ account, as listed in "Zespół HQ". */
export interface AdminListItem {
  id: string;
  email: string;
  /** False means access was revoked; the account is kept for the audit trail. */
  is_superadmin: boolean;
  created_at: string;
}

/** One entry in the audit trail. */
export interface AuditLogEntry {
  id: string;
  admin_email: string;
  /** A stable token such as `restaurant.impersonated`. Translated for display. */
  action: string;
  target_entity: string;
  created_at: string;
}

export interface AuditLogResponse {
  data: AuditLogEntry[];
  meta: PaginationMeta;
}

export interface ImpersonationResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  restaurant_id: string;
  restaurant_name: string;
}

/** GET /api/v1/admin/admins — every HQ account, revoked ones included. */
export async function fetchAdmins(): Promise<AdminListItem[]> {
  const { data } = await api.get<AdminListItem[]>('/api/v1/admin/admins');
  return data;
}

/**
 * POST /api/v1/admin/admins — adds a colleague.
 *
 * The password is sent once and hashed server-side; it is never stored here,
 * put in a query string or written to the audit trail. Whoever creates the
 * account passes it on out of band.
 */
export async function createAdmin(
  email: string,
  password: string,
): Promise<AdminListItem> {
  const { data } = await api.post<AdminListItem>('/api/v1/admin/admins', {
    email,
    password,
  });
  return data;
}

/** PUT /api/v1/admin/admins/{id}/revoke — takes away access, keeps the row. */
export async function revokeAdmin(adminId: string): Promise<AdminListItem> {
  const { data } = await api.put<AdminListItem>(
    `/api/v1/admin/admins/${adminId}/revoke`,
  );
  return data;
}

/** GET /api/v1/admin/audit-logs — the trail, newest first. */
export async function fetchAuditLogs(
  page: number,
  limit: number,
): Promise<AuditLogResponse> {
  const { data } = await api.get<AuditLogResponse>('/api/v1/admin/audit-logs', {
    params: { page, limit },
  });
  return data;
}

/**
 * POST /api/v1/admin/impersonate/{restaurantId} — a support session.
 *
 * Returns a real owner token for that restaurant, valid for an hour. The server
 * records who took it before it issues anything, so this call cannot happen
 * quietly.
 */
export async function impersonateRestaurant(
  restaurantId: string,
): Promise<ImpersonationResponse> {
  const { data } = await api.post<ImpersonationResponse>(
    `/api/v1/admin/impersonate/${restaurantId}`,
  );
  return data;
}
