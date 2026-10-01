import { api } from './api';
import type {
  CreateRestaurantRequest,
  ManualPaymentRequest,
  ManualPaymentResponse,
  RestaurantListItem,
  RestaurantListParams,
  RestaurantListResponse,
} from '../types';

/** GET /api/v1/admin/restaurants — paginated restaurant accounts. */
export async function fetchRestaurants(
  params: RestaurantListParams,
): Promise<RestaurantListResponse> {
  const { data } = await api.get<RestaurantListResponse>('/api/v1/admin/restaurants', {
    params,
  });
  return data;
}

/** POST /api/v1/admin/restaurants — creates a new restaurant account (201). */
export async function createRestaurant(
  payload: CreateRestaurantRequest,
): Promise<RestaurantListItem> {
  const { data } = await api.post<RestaurantListItem>(
    '/api/v1/admin/restaurants',
    payload,
  );
  return data;
}

/** POST /api/v1/admin/restaurants/{id}/manual-payment — books a manual transfer. */
export async function createManualPayment(
  restaurantId: string,
  payload: ManualPaymentRequest,
): Promise<ManualPaymentResponse> {
  const { data } = await api.post<ManualPaymentResponse>(
    `/api/v1/admin/restaurants/${restaurantId}/manual-payment`,
    payload,
  );
  return data;
}

/** Fields a superadmin may correct. Omitted keys are left alone. */
export interface RestaurantUpdateRequest {
  name?: string;
  contact_email?: string;
  contact_phone?: string;
  /** null takes the second panel language away. */
  panel_language?: string | null;
  country?: string;
  /** null or '' clears it. */
  address?: string | null;
  currency?: string;
  base_language?: string;
}

/** An activation link, for an operator to pass on. */
export interface ActivationLinkResponse {
  activation_url: string;
  expires_at: string;
  /** False for the copy-to-clipboard path, which sends no email. */
  emailed: boolean;
}

/**
 * PUT /api/v1/admin/restaurants/{id} — corrects basic details.
 *
 * Built for one situation above all: a mistyped `contact_email`, or an owner
 * who cannot open the inbox the welcome email went to. For an account that has
 * not activated yet, fixing the address here is the whole rescue — the login
 * identity is read from it at activation.
 */
export async function updateRestaurant(
  restaurantId: string,
  payload: RestaurantUpdateRequest,
): Promise<RestaurantListItem> {
  const { data } = await api.put<RestaurantListItem>(
    `/api/v1/admin/restaurants/${restaurantId}`,
    payload,
  );
  return data;
}

/** POST .../send-activation-link — emails a fresh welcome link. */
export async function sendActivationLink(
  restaurantId: string,
): Promise<ActivationLinkResponse> {
  const { data } = await api.post<ActivationLinkResponse>(
    `/api/v1/admin/restaurants/${restaurantId}/send-activation-link`,
  );
  return data;
}

/**
 * POST .../generate-activation-link — returns the link without emailing it.
 *
 * For when email itself is the problem: a dead inbox, a domain that bounces.
 * The operator passes it on by SMS or in person. Issuing it is recorded in the
 * audit log, so a link that sets someone's password is never handed out
 * silently.
 */
export async function generateActivationLink(
  restaurantId: string,
): Promise<ActivationLinkResponse> {
  const { data } = await api.post<ActivationLinkResponse>(
    `/api/v1/admin/restaurants/${restaurantId}/generate-activation-link`,
  );
  return data;
}
